import { and, asc, eq, or, sql } from "drizzle-orm";

import { aiUsageLogs, candidates } from "~/server/db/schema";
import { localizedTextSchema } from "~/shared/localized-ai";
import { formatExperienceMonths } from "~/utils/russian-plural";

import { generateCandidateAiAnalysis } from "./generate-candidate-ai-analysis";

type Database = typeof import("~/server/db").db;

const BACKFILL_OPERATION = "candidate_ai_metadata_backfill";
const DEFAULT_BATCH_SIZE = 3;
const MAX_BATCH_SIZE = 10;
const MAX_SOURCE_CHARACTERS = 12_000;

export type CandidateAiMetadataBackfillResult = {
  claimed: number;
  analysesUpdated: number;
  translationsUpdated: number;
  tagsUpdated: number;
  failed: number;
  skipped: boolean;
};

export function hasCompleteCandidateAiAnalysisTranslations(value: unknown) {
  return localizedTextSchema.safeParse(value).success;
}

export function hasCandidateTags(value: unknown) {
  return (
    Array.isArray(value) &&
    value.some((tag) => typeof tag === "string" && tag.trim().length > 0)
  );
}

type CandidateBackfillSource = {
  fullName: string;
  city: string | null;
  currentPosition: string | null;
  experience: number | null;
  salaryExpectation: number | null;
  salaryCurrency: string | null;
  skills: string[] | null;
  languages: { name: string; level: string }[] | null;
  workExperience:
    | {
        company: string;
        position: string;
        period: string;
        description: string[];
      }[]
    | null;
  education: { institution: string; gpa: string; period: string }[] | null;
  aiAnalysis: string | null;
};

export function formatCandidateForAiMetadataBackfill(
  candidate: CandidateBackfillSource,
) {
  const workExperience = (candidate.workExperience ?? []).map((item) =>
    [
      `${item.company}: ${item.position}`,
      item.period,
      item.description.filter(Boolean).join("; "),
    ]
      .filter(Boolean)
      .join(" — "),
  );
  const education = (candidate.education ?? []).map((item) =>
    [item.institution, item.gpa, item.period].filter(Boolean).join(" — "),
  );

  return [
    candidate.aiAnalysis?.trim()
      ? `Существующий AI-анализ:\n${candidate.aiAnalysis.trim()}`
      : "",
    `ФИО: ${candidate.fullName}`,
    `Город: ${candidate.city?.trim() || "Не указан"}`,
    `Текущая должность: ${candidate.currentPosition?.trim() || "Не указана"}`,
    `Опыт: ${formatExperienceMonths(candidate.experience) || "Не указан"}`,
    `Зарплатные ожидания: ${
      candidate.salaryExpectation
        ? `${candidate.salaryExpectation} ${candidate.salaryCurrency || "UZS"}`
        : "Не указаны"
    }`,
    `Навыки: ${(candidate.skills ?? []).join(", ") || "Не указаны"}`,
    `Языки: ${
      (candidate.languages ?? [])
        .map((language) => `${language.name} (${language.level})`)
        .join(", ") || "Не указаны"
    }`,
    `Опыт работы:\n${workExperience.join("\n") || "Не указан"}`,
    `Образование:\n${education.join("\n") || "Не указано"}`,
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, MAX_SOURCE_CHARACTERS);
}

/**
 * Backfills AI-derived candidate metadata without overwriting non-empty data.
 * New résumé flows already generate the multilingual summary; this worker also
 * repairs historical rows and supplies missing search tags for every source.
 * Recent failures cool down for one hour so a bad row cannot occupy every run.
 */
export async function backfillCandidateAiMetadata({
  db,
  batchSize = DEFAULT_BATCH_SIZE,
}: {
  db: Database;
  batchSize?: number;
}): Promise<CandidateAiMetadataBackfillResult> {
  if (
    !process.env.GOOGLE_API_KEY &&
    !process.env.GOOGLE_GENERATIVE_AI_API_KEY
  ) {
    return {
      claimed: 0,
      analysesUpdated: 0,
      translationsUpdated: 0,
      tagsUpdated: 0,
      failed: 0,
      skipped: true,
    };
  }

  const boundedBatchSize = Math.max(
    1,
    Math.min(MAX_BATCH_SIZE, Math.floor(batchSize)),
  );
  const missingAnalysis = sql<boolean>`nullif(btrim(${candidates.aiAnalysis}), '') is null`;
  const missingTranslations = sql<boolean>`(
    ${candidates.aiAnalysisTranslations} is null
    or nullif(btrim(${candidates.aiAnalysisTranslations}->>'ru'), '') is null
    or nullif(btrim(${candidates.aiAnalysisTranslations}->>'en'), '') is null
    or nullif(btrim(${candidates.aiAnalysisTranslations}->>'uz'), '') is null
  )`;
  const missingTags = sql<boolean>`coalesce(json_array_length(${candidates.tags}), 0) = 0`;
  const hasUsefulSource = sql<boolean>`(
    nullif(btrim(${candidates.aiAnalysis}), '') is not null
    or nullif(btrim(${candidates.currentPosition}), '') is not null
    or coalesce(json_array_length(${candidates.skills}), 0) > 0
    or coalesce(json_array_length(${candidates.workExperience}), 0) > 0
    or coalesce(json_array_length(${candidates.education}), 0) > 0
  )`;
  const noRecentFailure = sql<boolean>`not exists (
    select 1
    from ${aiUsageLogs}
    where ${aiUsageLogs.candidateId} = ${candidates.id}
      and ${aiUsageLogs.operation} = ${BACKFILL_OPERATION}
      and ${aiUsageLogs.status} = 'failed'
      and ${aiUsageLogs.createdAt} > now() - interval '1 hour'
  )`;

  const rows = await db
    .select({
      id: candidates.id,
      companyId: candidates.companyId,
      fullName: candidates.fullName,
      city: candidates.city,
      currentPosition: candidates.currentPosition,
      experience: candidates.experience,
      salaryExpectation: candidates.salaryExpectation,
      salaryCurrency: candidates.salaryCurrency,
      skills: candidates.skills,
      languages: candidates.languages,
      workExperience: candidates.workExperience,
      education: candidates.education,
      aiAnalysis: candidates.aiAnalysis,
      aiAnalysisTranslations: candidates.aiAnalysisTranslations,
      tags: candidates.tags,
    })
    .from(candidates)
    .where(
      and(
        hasUsefulSource,
        or(missingAnalysis, missingTranslations, missingTags),
        noRecentFailure,
      ),
    )
    .orderBy(asc(candidates.createdAt))
    .limit(boundedBatchSize);

  const outcomes = await Promise.all(
    rows.map(async (candidate) => {
      try {
        const generated = await generateCandidateAiAnalysis(
          {
            resumeText: formatCandidateForAiMetadataBackfill(candidate),
            sourceLabel: "сохранённого профиля кандидата",
          },
          {
            db,
            companyId: candidate.companyId,
            candidateId: candidate.id,
            operation: BACKFILL_OPERATION,
          },
        );

        if (
          generated.status !== "success" ||
          !generated.text.trim() ||
          !hasCompleteCandidateAiAnalysisTranslations(generated.translations) ||
          !hasCandidateTags(generated.tags)
        ) {
          return {
            analysisUpdated: false,
            translationsUpdated: false,
            tagsUpdated: false,
            failed: true,
          };
        }

        const [analysisUpdate, translationsUpdate, tagsUpdate] =
          await Promise.all([
            candidate.aiAnalysis?.trim()
              ? Promise.resolve([])
              : db
                  .update(candidates)
                  .set({ aiAnalysis: generated.text })
                  .where(and(eq(candidates.id, candidate.id), missingAnalysis))
                  .returning({ id: candidates.id }),
            hasCompleteCandidateAiAnalysisTranslations(
              candidate.aiAnalysisTranslations,
            )
              ? Promise.resolve([])
              : db
                  .update(candidates)
                  .set({ aiAnalysisTranslations: generated.translations })
                  .where(
                    and(eq(candidates.id, candidate.id), missingTranslations),
                  )
                  .returning({ id: candidates.id }),
            hasCandidateTags(candidate.tags)
              ? Promise.resolve([])
              : db
                  .update(candidates)
                  .set({ tags: generated.tags })
                  .where(and(eq(candidates.id, candidate.id), missingTags))
                  .returning({ id: candidates.id }),
          ]);

        return {
          analysisUpdated: analysisUpdate.length > 0,
          translationsUpdated: translationsUpdate.length > 0,
          tagsUpdated: tagsUpdate.length > 0,
          failed: false,
        };
      } catch (error) {
        console.error("Candidate AI metadata backfill failed", {
          candidateId: candidate.id,
          error,
        });
        return {
          analysisUpdated: false,
          translationsUpdated: false,
          tagsUpdated: false,
          failed: true,
        };
      }
    }),
  );

  return {
    claimed: rows.length,
    analysesUpdated: outcomes.filter((outcome) => outcome.analysisUpdated)
      .length,
    translationsUpdated: outcomes.filter(
      (outcome) => outcome.translationsUpdated,
    ).length,
    tagsUpdated: outcomes.filter((outcome) => outcome.tagsUpdated).length,
    failed: outcomes.filter((outcome) => outcome.failed).length,
    skipped: false,
  };
}
