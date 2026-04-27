import { and, count, desc, eq, inArray } from "drizzle-orm";

import {
  candidates,
  candidateVacancies,
  type vacancies,
  type vacancyPublications,
} from "~/server/db/schema";
import type { HhVacancy } from "~/server/services/hh";

type DatabaseClient = typeof import("~/server/db").db;

export type VacancyStatus =
  | "active"
  | "draft"
  | "paused"
  | "closed"
  | "archive";
export type SalaryCurrency = "UZS" | "USD";

export function toVacancyStatus(value: string | null): VacancyStatus {
  switch (value) {
    case "active":
    case "draft":
    case "paused":
    case "closed":
    case "archive":
      return value;
    default:
      return "active";
  }
}

export function toSalaryCurrency(value: string | null): SalaryCurrency {
  return value === "USD" ? "USD" : "UZS";
}

export function formatVacancy(
  vacancy: typeof vacancies.$inferSelect,
  responses = vacancy.responses ?? 0,
) {
  return {
    id: vacancy.id,
    title: vacancy.title,
    level: vacancy.level ?? "",
    status: toVacancyStatus(vacancy.status),
    city: vacancy.city ?? "",
    responses,
    workType: vacancy.workType ?? "",
    salaryExpectation: vacancy.salaryExpectation ?? undefined,
    salaryCurrency: toSalaryCurrency(vacancy.salaryCurrency),
    workScheduleStart: vacancy.workScheduleStart ?? "09:00",
    workScheduleEnd: vacancy.workScheduleEnd ?? "18:00",
    comments: vacancy.comments ?? "",
    tasks: vacancy.tasks ?? "",
    team: vacancy.team ?? "",
    companyDescription: vacancy.companyDescription ?? "",
    companyId: vacancy.companyId ?? undefined,
    publishedAt: undefined,
    source: "local" as const,
    externalUrl: undefined,
  };
}

export function formatVacancyPublication(
  publication: typeof vacancyPublications.$inferSelect,
) {
  return {
    id: publication.id,
    vacancyId: publication.vacancyId,
    name: publication.name,
    description: publication.description,
    isActive: publication.isActive,
    sources: publication.sources ?? [],
    createdAt: publication.createdAt,
    updatedAt: publication.updatedAt ?? undefined,
  };
}

export function formatHhVacancy(vacancy: HhVacancy, companyId: string) {
  return {
    id: `hh_${vacancy.id}`,
    title: vacancy.title,
    level: vacancy.level,
    status: vacancy.status,
    city: vacancy.city,
    responses: vacancy.responses,
    workType: vacancy.workType,
    salaryExpectation: undefined,
    salaryCurrency: "UZS" as const,
    workScheduleStart: undefined,
    workScheduleEnd: undefined,
    comments: "",
    tasks: "",
    team: "",
    companyDescription: "",
    companyId,
    publishedAt: vacancy.publishedAt,
    source: "hh.uz" as const,
    externalUrl: vacancy.externalUrl,
  };
}

export function isHhVacancyId(value: string) {
  return value.startsWith("hh_");
}

export async function getVacancyRelatedCandidates(
  db: DatabaseClient,
  vacancyId: string,
  companyId: string,
) {
  return db
    .select({
      id: candidates.id,
      fullName: candidates.fullName,
      status: candidates.status,
      city: candidates.city,
      experience: candidates.experience,
      matchScore: candidates.matchScore,
      aiAnalysis: candidates.aiAnalysis,
      currentPosition: candidates.currentPosition,
      contacts: candidates.contacts,
      languages: candidates.languages,
      skills: candidates.skills,
      salaryExpectation: candidates.salaryExpectation,
      salaryCurrency: candidates.salaryCurrency,
      tags: candidates.tags,
      source: candidates.source,
      workExperience: candidates.workExperience,
      resumeFileId: candidates.resumeFileId,
    })
    .from(candidateVacancies)
    .innerJoin(candidates, eq(candidateVacancies.candidateId, candidates.id))
    .where(
      and(
        eq(candidateVacancies.vacancyId, vacancyId),
        eq(candidates.companyId, companyId),
      ),
    )
    .orderBy(desc(candidateVacancies.id));
}

export async function getVacancyResponseCounts(
  db: DatabaseClient,
  vacancyIds: string[],
) {
  if (vacancyIds.length === 0) {
    return new Map<string, number>();
  }

  const rows = await db
    .select({
      vacancyId: candidateVacancies.vacancyId,
      total: count(candidateVacancies.id),
    })
    .from(candidateVacancies)
    .where(inArray(candidateVacancies.vacancyId, vacancyIds))
    .groupBy(candidateVacancies.vacancyId);

  return new Map(rows.map((row) => [row.vacancyId, row.total]));
}
