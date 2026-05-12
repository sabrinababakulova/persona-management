import { and, desc, eq } from "drizzle-orm";

import { formatActivityTime } from "~/server/activity/recent-activity";
import {
  candidates,
  candidateVacancies,
  recentActivityLogs,
  users,
  vacancies,
} from "~/server/db/schema";
import type { HhResumeCandidate } from "~/server/services/hh";
import { buildCandidateResumeUrl } from "~/server/storage/resume-storage";

type DatabaseClient = typeof import("~/server/db").db;

/** Raw candidate row as stored in PostgreSQL. */
export type StoredCandidateRecord = typeof candidates.$inferSelect;

/**
 * Converts a parsed hh.uz resume into plain text for AI analysis.
 *
 * The output keeps section labels in Russian because the generated assessment is
 * shown directly in the Russian-language UI.
 */
export function formatHhCandidateForAiAnalysis(candidate: HhResumeCandidate) {
  const contactLines = [
    candidate.contacts.phone
      ? `Телефон: ${candidate.contacts.phone.trim()}`
      : "",
    candidate.contacts.email ? `Email: ${candidate.contacts.email.trim()}` : "",
    candidate.contacts.telegram
      ? `Telegram: ${candidate.contacts.telegram.trim()}`
      : "",
  ].filter(Boolean);

  const workExperienceLines = candidate.workExperience.flatMap((item) => {
    const lines = [
      `Компания: ${item.company || "Не указано"}`,
      `Должность: ${item.position || "Не указано"}`,
      `Период: ${item.period || "Не указан"}`,
    ];

    if (item.description.length > 0) {
      lines.push(`Обязанности и достижения: ${item.description.join("; ")}`);
    }

    return [lines.join("\n")];
  });

  const educationLines = candidate.education.map((item) =>
    [
      `Учебное заведение: ${item.institution || "Не указано"}`,
      `Результат: ${item.gpa || "Не указан"}`,
      `Период: ${item.period || "Не указан"}`,
    ].join("\n"),
  );

  return [
    `ФИО: ${candidate.fullName || "Не указано"}`,
    `Город: ${candidate.city || "Не указан"}`,
    `Текущая должность: ${candidate.currentPosition || "Не указана"}`,
    `Опыт: ${candidate.experience || "Не указан"}`,
    `Зарплатные ожидания: ${
      candidate.salaryExpectation > 0
        ? `${candidate.salaryExpectation} ${candidate.salaryCurrency}`
        : "Не указаны"
    }`,
    `Навыки: ${
      candidate.skills.length > 0 ? candidate.skills.join(", ") : "Не указаны"
    }`,
    `Языки: ${
      candidate.languages.length > 0
        ? candidate.languages
            .map(
              (item) => `${item.name} (${item.level || "уровень не указан"})`,
            )
            .join(", ")
        : "Не указаны"
    }`,
    `Контакты:\n${contactLines.length > 0 ? contactLines.join("\n") : "Не указаны"}`,
    `Опыт работы:\n${
      workExperienceLines.length > 0
        ? workExperienceLines.join("\n\n")
        : "Не указан"
    }`,
    `Образование:\n${
      educationLines.length > 0 ? educationLines.join("\n\n") : "Не указано"
    }`,
  ].join("\n\n");
}

/** Maps hh.uz contact fields into the JSON shape stored in `candidates.contacts`. */
export function toStoredCandidateContacts(candidate: HhResumeCandidate) {
  return [
    candidate.contacts.phone
      ? { type: "phone", value: candidate.contacts.phone.trim() }
      : null,
    candidate.contacts.email
      ? { type: "email", value: candidate.contacts.email.trim() }
      : null,
    candidate.contacts.telegram
      ? { type: "telegram", value: candidate.contacts.telegram.trim() }
      : null,
  ].filter((contact): contact is { type: string; value: string } =>
    Boolean(contact?.value),
  );
}

/**
 * Fetches one stored candidate scoped to the current company.
 *
 * Returns `null` instead of throwing so callers can fall back to external
 * providers such as hh.uz.
 */
export async function getStoredCandidateRecord(
  db: DatabaseClient,
  companyId: string,
  candidateId: string,
) {
  const rows = await db
    .select()
    .from(candidates)
    .where(
      and(eq(candidates.id, candidateId), eq(candidates.companyId, companyId)),
    )
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Builds the candidate detail DTO consumed by the candidate profile page.
 *
 * Combines the candidate row with related vacancies, recent activity, normalized
 * contacts, and resume metadata. Optional resume overrides are used for external
 * resumes that are viewable but not stored in Directus.
 */
export async function buildCandidateDetailResponse({
  db,
  companyId,
  candidate,
  resumeNameOverride,
  resumeUrlOverride,
}: {
  db: DatabaseClient;
  companyId: string;
  candidate: StoredCandidateRecord;
  resumeNameOverride?: string;
  resumeUrlOverride?: string;
}) {
  const contactsArr =
    ((candidate.contacts ?? []) as {
      type: string;
      value: string;
    }[]) ?? [];
  const phone = contactsArr.find((ct) => ct.type === "phone")?.value ?? "";
  const telegram =
    contactsArr.find((ct) => ct.type === "telegram")?.value ?? "";
  const email = contactsArr.find((ct) => ct.type === "email")?.value ?? "";

  const relatedVacancyRows = await db
    .select({
      id: vacancies.id,
      title: vacancies.title,
    })
    .from(candidateVacancies)
    .innerJoin(vacancies, eq(candidateVacancies.vacancyId, vacancies.id))
    .where(
      and(
        eq(candidateVacancies.candidateId, candidate.id),
        eq(vacancies.companyId, companyId),
      ),
    )
    .orderBy(desc(candidateVacancies.id));

  const activityItems = await db
    .select({
      id: recentActivityLogs.id,
      actorName: recentActivityLogs.actorName,
      createdAt: recentActivityLogs.createdAt,
      action: recentActivityLogs.action,
      targetName: recentActivityLogs.targetName,
      targetStatus: recentActivityLogs.targetStatus,
      userAvatar: users.image,
    })
    .from(recentActivityLogs)
    .leftJoin(users, eq(recentActivityLogs.actorUserId, users.id))
    .where(
      and(
        eq(recentActivityLogs.companyId, companyId),
        eq(recentActivityLogs.entityType, "candidate"),
        eq(recentActivityLogs.entityId, candidate.id),
      ),
    )
    .orderBy(desc(recentActivityLogs.createdAt))
    .limit(10);

  return {
    id: candidate.id,
    name: candidate.fullName,
    location: (candidate.city ?? "").toUpperCase(),
    experience: candidate.experience ?? "",
    matchScore: candidate.matchScore ?? 0,
    salaryExpectation: candidate.salaryExpectation ?? 0,
    salaryCurrency: candidate.salaryCurrency ?? "UZS",
    status: candidate.status ?? "new",
    source: candidate.source ?? "",
    tags: (candidate.tags ?? []) as string[],
    currentPosition: candidate.currentPosition ?? "",
    languages: (candidate.languages ?? []) as {
      name: string;
      level: string;
    }[],
    skills: (candidate.skills ?? []) as string[],
    contacts: { phone, telegram, email },
    aiAnalysis: candidate.aiAnalysis ?? "",
    otherVacancies: relatedVacancyRows.map((vacancy) => vacancy.title),
    relatedVacancies: relatedVacancyRows,
    workExperience: (candidate.workExperience ?? []) as {
      company: string;
      position: string;
      period: string;
      isCurrent?: boolean;
      description: string[];
    }[],
    education: (candidate.education ?? []) as {
      institution: string;
      gpa: string;
      period: string;
      isCurrent?: boolean;
    }[],
    resumeFile: {
      name:
        candidate.resumeFileName ??
        (resumeUrlOverride ? (resumeNameOverride ?? "") : ""),
      size: candidate.resumeFileSize ?? "",
      url: candidate.resumeFileId
        ? buildCandidateResumeUrl(candidate.id)
        : (resumeUrlOverride ?? ""),
    },
    notes: (candidate.notes ?? []) as {
      id: string;
      content: string;
      author: string;
      createdAt: string;
    }[],
    activities: activityItems.map((activity) => ({
      id: activity.id,
      userName: activity.actorName,
      userAvatar: activity.userAvatar ?? "",
      action: activity.action,
      targetName: activity.targetName,
      targetStatus: activity.targetStatus,
      timeAgo: formatActivityTime(
        activity.createdAt ? new Date(activity.createdAt) : new Date(),
      ),
    })),
  };
}
