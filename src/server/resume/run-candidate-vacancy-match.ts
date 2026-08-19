import { and, eq, isNull, ne, or } from "drizzle-orm";

import { candidates, candidateVacancies, vacancies } from "~/server/db/schema";
import { generateCandidateVacancyMatch } from "~/server/resume/generate-candidate-vacancy-match";

type DatabaseClient = typeof import("~/server/db").db;

export type PersistCandidateVacancyMatchResult =
  | { status: "success"; score: number }
  | { status: "skipped" }
  | { status: "failed"; errorMessage: string };

/** Runs and persists one vacancy-specific match for an existing application. */
export async function runAndPersistCandidateVacancyMatch(input: {
  db: DatabaseClient;
  candidateId: string;
  vacancyId: string;
  companyId: string;
  operation?: string;
}): Promise<PersistCandidateVacancyMatchResult> {
  const [pair] = await input.db
    .select({
      applicationId: candidateVacancies.id,
      fullName: candidates.fullName,
      city: candidates.city,
      experience: candidates.experience,
      currentPosition: candidates.currentPosition,
      skills: candidates.skills,
      languages: candidates.languages,
      workExperience: candidates.workExperience,
      education: candidates.education,
      salaryExpectation: candidates.salaryExpectation,
      candidateSalaryCurrency: candidates.salaryCurrency,
      title: vacancies.title,
      descriptionHtml: vacancies.descriptionHtml,
      areaId: vacancies.areaId,
      employmentId: vacancies.employmentId,
      scheduleId: vacancies.scheduleId,
      experienceId: vacancies.experienceId,
      professionalRoleId: vacancies.professionalRoleId,
      vacancyTypeId: vacancies.vacancyTypeId,
      salaryFrom: vacancies.salaryFrom,
      salaryTo: vacancies.salaryTo,
      vacancySalaryCurrency: vacancies.salaryCurrency,
    })
    .from(candidateVacancies)
    .innerJoin(candidates, eq(candidateVacancies.candidateId, candidates.id))
    .innerJoin(vacancies, eq(candidateVacancies.vacancyId, vacancies.id))
    .where(
      and(
        eq(candidateVacancies.candidateId, input.candidateId),
        eq(candidateVacancies.vacancyId, input.vacancyId),
        eq(candidates.companyId, input.companyId),
        eq(vacancies.companyId, input.companyId),
        eq(vacancies.isPublication, false),
        eq(vacancies.isInternal, false),
        or(isNull(vacancies.status), ne(vacancies.status, "archive")),
      ),
    )
    .limit(1);

  if (!pair) {
    // Warehouse and archived targets intentionally do not consume match tokens.
    return { status: "skipped" };
  }

  const match = await generateCandidateVacancyMatch(
    {
      vacancy: {
        title: pair.title,
        descriptionHtml: pair.descriptionHtml,
        areaId: pair.areaId,
        employmentId: pair.employmentId,
        scheduleId: pair.scheduleId,
        experienceId: pair.experienceId,
        professionalRoleId: pair.professionalRoleId,
        vacancyTypeId: pair.vacancyTypeId,
        salaryFrom: pair.salaryFrom,
        salaryTo: pair.salaryTo,
        salaryCurrency: pair.vacancySalaryCurrency,
      },
      candidate: {
        fullName: pair.fullName,
        city: pair.city,
        experience: pair.experience,
        currentPosition: pair.currentPosition,
        skills: pair.skills,
        languages: pair.languages,
        workExperience: pair.workExperience,
        education: pair.education,
        salaryExpectation: pair.salaryExpectation,
        salaryCurrency: pair.candidateSalaryCurrency,
      },
    },
    {
      db: input.db,
      companyId: input.companyId,
      candidateId: input.candidateId,
      operation: input.operation ?? "candidate_vacancy_match",
    },
  );

  if (match.status === "failed") {
    return match;
  }

  await input.db
    .update(candidateVacancies)
    .set({
      matchScore: match.score,
      matchAnalysis: match.analysis.ru || null,
      matchAnalysisTranslations: match.analysis,
      matchedSkills: match.matchedRequirements.ru,
      matchedSkillsTranslations: match.matchedRequirements,
      missingSkills: match.missingRequirements.ru,
      missingSkillsTranslations: match.missingRequirements,
    })
    .where(eq(candidateVacancies.id, pair.applicationId));

  const applicationScores = await input.db
    .select({ score: candidateVacancies.matchScore })
    .from(candidateVacancies)
    .where(eq(candidateVacancies.candidateId, input.candidateId));
  const bestScore = applicationScores.reduce<number | null>(
    (best, row) =>
      row.score === null
        ? best
        : best === null
          ? row.score
          : Math.max(best, row.score),
    null,
  );
  if (bestScore !== null) {
    await input.db
      .update(candidates)
      .set({ matchScore: bestScore })
      .where(eq(candidates.id, input.candidateId));
  }

  return { status: "success", score: match.score };
}
