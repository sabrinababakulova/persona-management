import { and, count, desc, eq, inArray } from "drizzle-orm";

import { candidates, candidateVacancies, vacancies } from "~/server/db/schema";
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
    parentId: vacancy.parentId,
    title: vacancy.title,
    status: toVacancyStatus(vacancy.status),
    responses,
    areaId: vacancy.areaId ?? "",
    employmentId: vacancy.employmentId ?? "",
    scheduleId: vacancy.scheduleId ?? "",
    experienceId: vacancy.experienceId ?? "",
    professionalRoleId: vacancy.professionalRoleId ?? "",
    vacancyTypeId: vacancy.vacancyTypeId ?? "open",
    billingTypeId: vacancy.billingTypeId ?? "",
    salaryFrom: vacancy.salaryFrom ?? undefined,
    salaryTo: vacancy.salaryTo ?? undefined,
    salaryCurrency: toSalaryCurrency(vacancy.salaryCurrency),
    descriptionHtml: vacancy.descriptionHtml ?? "",
    contactPhone: vacancy.contactPhone ?? "",
    companyId: vacancy.companyId ?? undefined,
    hhVacancyId: vacancy.hhVacancyId ?? null,
    hhDraftId: vacancy.hhDraftId ?? null,
    personHunterVacancyId: vacancy.personHunterVacancyId ?? null,
    personHunterUniqueCode: vacancy.personHunterUniqueCode ?? null,
    personHunterMeta: vacancy.personHunterMeta ?? null,
    telegramPostId: vacancy.telegramPostId ?? null,
    publishedAt: undefined,
    source: "local" as const,
    externalUrl: undefined,
  };
}

export function formatHhVacancy(vacancy: HhVacancy, companyId: string) {
  // The hh.uz search response only exposes the human-readable name fields (city, level,
  // workType) but not the lookup IDs we now persist. Leave the ID fields blank for hh.uz-only
  // listings — the Vacancy interface treats them as optional read-only metadata.
  return {
    id: `hh_${vacancy.id}`,
    parentId: `hh_${vacancy.id}`,
    title: vacancy.title,
    status: vacancy.status,
    responses: vacancy.responses,
    areaId: "",
    employmentId: "",
    scheduleId: "",
    experienceId: "",
    professionalRoleId: "",
    vacancyTypeId: "open",
    billingTypeId: "",
    salaryFrom: undefined,
    salaryTo: undefined,
    salaryCurrency: "UZS" as const,
    descriptionHtml: "",
    contactPhone: "",
    companyId,
    hhVacancyId: vacancy.id,
    hhDraftId: null,
    personHunterVacancyId: null,
    personHunterUniqueCode: null,
    personHunterMeta: null,
    telegramPostId: null,
    publishedAt: vacancy.publishedAt,
    source: "hh.uz" as const,
    externalUrl: vacancy.externalUrl,
  };
}

export function isHhVacancyId(value: string) {
  return value.startsWith("hh_");
}

/** Restricts recruiter-facing queries to vacancies owned by application users. */
export function isUserVisibleVacancy() {
  return eq(vacancies.isInternal, false);
}

export async function getVacanciesRelatedCandidates(
  db: DatabaseClient,
  vacancyIds: string[],
  companyId: string,
) {
  if (vacancyIds.length === 0) {
    return [];
  }

  // `matchScore` is read from `candidateVacancies` (per-application) so the
  // funnel reflects the fit for THIS vacancy, not the candidate's best score
  // against a different one. Falls back to the candidate's global score (the
  // denormalised maximum written by enrichment) so older rows that predate the
  // per-application column still render something.
  return db
    .select({
      id: candidates.id,
      fullName: candidates.fullName,
      status: candidates.status,
      city: candidates.city,
      experience: candidates.experience,
      matchScore: candidateVacancies.matchScore,
      candidateMatchScore: candidates.matchScore,
      matchAnalysis: candidateVacancies.matchAnalysis,
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
        inArray(candidateVacancies.vacancyId, vacancyIds),
        eq(candidates.companyId, companyId),
      ),
    )
    .orderBy(desc(candidateVacancies.id));
}

/**
 * Returns the response (отклики) total for each supplied base vacancy id, rolling up the
 * responses of its per-channel publications.
 *
 * A base vacancy self-references (`parentId === id`) and each publication points back at it
 * via `parentId`, so selecting every row whose `parentId` is a base vacancy id yields the base
 * vacancy plus all of its publications. Candidate links against any of those ids count toward
 * the base vacancy's total.
 */
export async function getVacancyResponseCounts(
  db: DatabaseClient,
  baseVacancyIds: string[],
) {
  if (baseVacancyIds.length === 0) {
    return new Map<string, number>();
  }

  const vacancyRows = await db
    .select({ id: vacancies.id, parentId: vacancies.parentId })
    .from(vacancies)
    .where(inArray(vacancies.parentId, baseVacancyIds));

  const baseIdByVacancyId = new Map<string, string>();
  for (const row of vacancyRows) {
    baseIdByVacancyId.set(row.id, row.parentId);
  }

  const vacancyIds = [...baseIdByVacancyId.keys()];
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

  const totals = new Map<string, number>();
  for (const row of rows) {
    const baseId = baseIdByVacancyId.get(row.vacancyId);
    if (!baseId) {
      continue;
    }
    totals.set(baseId, (totals.get(baseId) ?? 0) + row.total);
  }

  return totals;
}
