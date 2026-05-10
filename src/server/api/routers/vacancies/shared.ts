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

export type VacancyConnection = "telegram" | "hh.uz";

export function formatVacancy(
  vacancy: typeof vacancies.$inferSelect,
  responses = vacancy.responses ?? 0,
  publicationPlatforms?: ReadonlySet<string>,
) {
  const connections: VacancyConnection[] = [];
  if (publicationPlatforms?.has("telegram")) {
    connections.push("telegram");
  }
  if (publicationPlatforms?.has("hh.uz") || vacancy.hhVacancyId) {
    connections.push("hh.uz");
  }

  return {
    id: vacancy.id,
    title: vacancy.title,
    status: toVacancyStatus(vacancy.status),
    responses,
    areaId: vacancy.areaId ?? "",
    employmentId: vacancy.employmentId ?? "",
    scheduleId: vacancy.scheduleId ?? "",
    experienceId: vacancy.experienceId ?? "",
    professionalRoleId: vacancy.professionalRoleId ?? "",
    billingTypeId: vacancy.billingTypeId ?? "",
    salaryFrom: vacancy.salaryFrom ?? undefined,
    salaryTo: vacancy.salaryTo ?? undefined,
    salaryCurrency: toSalaryCurrency(vacancy.salaryCurrency),
    descriptionHtml: vacancy.descriptionHtml ?? "",
    contactPhone: vacancy.contactPhone ?? "",
    companyId: vacancy.companyId ?? undefined,
    hhVacancyId: vacancy.hhVacancyId ?? null,
    publishedAt: undefined,
    source: "local" as const,
    externalUrl: undefined,
    connections,
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
  // The hh.uz search response only exposes the human-readable name fields (city, level,
  // workType) but not the lookup IDs we now persist. Leave the ID fields blank for hh.uz-only
  // listings — the Vacancy interface treats them as optional read-only metadata.
  return {
    id: `hh_${vacancy.id}`,
    title: vacancy.title,
    status: vacancy.status,
    responses: vacancy.responses,
    areaId: "",
    employmentId: "",
    scheduleId: "",
    experienceId: "",
    professionalRoleId: "",
    billingTypeId: "",
    salaryFrom: undefined,
    salaryTo: undefined,
    salaryCurrency: "UZS" as const,
    descriptionHtml: "",
    contactPhone: "",
    companyId,
    hhVacancyId: vacancy.id,
    publishedAt: vacancy.publishedAt,
    source: "hh.uz" as const,
    externalUrl: vacancy.externalUrl,
    connections: ["hh.uz"] as VacancyConnection[],
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
