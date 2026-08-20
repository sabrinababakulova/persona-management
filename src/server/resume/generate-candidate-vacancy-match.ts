import { mastra } from "~/mastra";
import {
  type CandidateVacancyMatch,
  candidateVacancyMatchSchema,
} from "~/schemas/candidate-vacancy-match";
import { recordAiUsage } from "~/server/ai/usage-logging";
import { stripHtml } from "~/server/services/hh/shared";
import { normalizeAiTags } from "~/shared/ai-tags";
import type { LocalizedStringList, LocalizedText } from "~/shared/localized-ai";
import { formatExperienceMonths } from "~/utils/russian-plural";

type Database = typeof import("~/server/db").db;

type AiUsageContext = {
  db: Database;
  userId?: string | null;
  companyId?: string | null;
  candidateId?: string | null;
  operation?: string;
};

export type CandidateMatchInput = {
  vacancy: {
    title: string | null;
    descriptionHtml?: string | null;
    areaId?: string | null;
    employmentId?: string | null;
    scheduleId?: string | null;
    experienceId?: string | null;
    professionalRoleId?: string | null;
    vacancyTypeId?: string | null;
    salaryFrom?: number | null;
    salaryTo?: number | null;
    salaryCurrency?: string | null;
  };
  candidate: {
    fullName: string | null;
    city?: string | null;
    experience?: number | null;
    currentPosition?: string | null;
    skills?: string[] | null;
    languages?: Array<{ name: string; level: string }> | null;
    workExperience?: Array<{
      company: string;
      position: string;
      period: string;
      description?: string[];
    }> | null;
    education?: Array<{
      institution: string;
      gpa: string;
      period: string;
    }> | null;
    salaryExpectation?: number | null;
    salaryCurrency?: string | null;
  };
};

export type CandidateMatchResult =
  | {
      status: "success";
      score: number;
      analysis: LocalizedText;
      matchedRequirements: LocalizedStringList;
      missingRequirements: LocalizedStringList;
    }
  | { status: "failed"; errorMessage: string };

const MAX_DESCRIPTION_CHARS = 4_000;

function formatVacancyBlock(vacancy: CandidateMatchInput["vacancy"]): string {
  const description = stripHtml(vacancy.descriptionHtml ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_DESCRIPTION_CHARS);
  const salary =
    vacancy.salaryFrom != null || vacancy.salaryTo != null
      ? `${vacancy.salaryFrom ?? "?"}–${vacancy.salaryTo ?? "?"} ${vacancy.salaryCurrency ?? ""}`.trim()
      : "Не указана";

  return [
    `Название: ${vacancy.title?.trim() || "Не указано"}`,
    `Описание: ${description || "Не указано"}`,
    `Опыт (id): ${vacancy.experienceId || "Не указан"}`,
    `Тип занятости (id): ${vacancy.employmentId || "Не указан"}`,
    `График (id): ${vacancy.scheduleId || "Не указан"}`,
    `Профессиональная роль (id): ${vacancy.professionalRoleId || "Не указана"}`,
    `Регион (id): ${vacancy.areaId || "Не указан"}`,
    `Тип вакансии (id): ${vacancy.vacancyTypeId || "Не указан"}`,
    `Зарплата: ${salary}`,
  ].join("\n");
}

function formatCandidateBlock(
  candidate: CandidateMatchInput["candidate"],
): string {
  const skills = (candidate.skills ?? []).filter((skill) => skill?.trim());
  const languages = (candidate.languages ?? []).filter((language) =>
    language?.name?.trim(),
  );
  const workExperience = (candidate.workExperience ?? []).map((item) => {
    const responsibilities = (item.description ?? [])
      .map((line) => line.trim())
      .filter(Boolean);
    return [
      `  Компания: ${item.company || "Не указано"}`,
      `  Должность: ${item.position || "Не указана"}`,
      `  Период: ${item.period || "Не указан"}`,
      responsibilities.length > 0
        ? `  Обязанности: ${responsibilities.join("; ")}`
        : null,
    ]
      .filter(Boolean)
      .join("\n");
  });
  const education = (candidate.education ?? []).map((item) =>
    [
      `  Заведение: ${item.institution || "Не указано"}`,
      `  Степень/результат: ${item.gpa || "Не указан"}`,
      `  Период: ${item.period || "Не указан"}`,
    ].join("\n"),
  );

  const salary =
    candidate.salaryExpectation != null && candidate.salaryExpectation > 0
      ? `${candidate.salaryExpectation} ${candidate.salaryCurrency ?? ""}`.trim()
      : "Не указаны";

  return [
    `ФИО: ${candidate.fullName?.trim() || "Не указано"}`,
    `Город: ${candidate.city?.trim() || "Не указан"}`,
    `Опыт (текст): ${formatExperienceMonths(candidate.experience) || "Не указан"}`,
    `Текущая должность: ${candidate.currentPosition?.trim() || "Не указана"}`,
    `Зарплатные ожидания: ${salary}`,
    `Навыки: ${skills.length > 0 ? skills.join(", ") : "Не указаны"}`,
    `Языки: ${
      languages.length > 0
        ? languages
            .map(
              (item) => `${item.name} (${item.level || "уровень не указан"})`,
            )
            .join(", ")
        : "Не указаны"
    }`,
    `Опыт работы:\n${
      workExperience.length > 0 ? workExperience.join("\n\n") : "Не указан"
    }`,
    `Образование:\n${education.length > 0 ? education.join("\n\n") : "Не указано"}`,
  ].join("\n\n");
}

function clampScore(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  return Math.min(100, Math.max(0, Math.round(value)));
}

/**
 * Runs the candidate-vacancy match agent and returns a clamped 0–100 score.
 *
 * The agent is told to return structured JSON; we additionally clamp here so a
 * model that strays outside the contract can't poison the column. AI usage is
 * logged through the shared `recordAiUsage` so this counts toward the same
 * billing/observability surface as the resume analyzer and summary agents.
 */
export async function generateCandidateVacancyMatch(
  input: CandidateMatchInput,
  usageContext?: AiUsageContext,
): Promise<CandidateMatchResult> {
  if (
    !process.env.GOOGLE_API_KEY &&
    !process.env.GOOGLE_GENERATIVE_AI_API_KEY
  ) {
    return {
      status: "failed",
      errorMessage:
        "GOOGLE_API_KEY или GOOGLE_GENERATIVE_AI_API_KEY не задан в окружении",
    };
  }

  const operation = usageContext?.operation ?? "candidate_vacancy_match";
  const promptText = `Evaluate this candidate specifically against this vacancy.

VACANCY
${formatVacancyBlock(input.vacancy)}

Candidate
${formatCandidateBlock(input.candidate)}

Return the structured multilingual score, analysis, matched requirements, and
missing or unconfirmed requirements defined in your instructions.`;

  try {
    const matchAgent = mastra.getAgent("candidateVacancyMatch");
    const result = await matchAgent.generate(
      [
        {
          role: "user",
          content: [{ type: "text" as const, text: promptText }],
        },
      ],
      {
        structuredOutput: {
          schema: candidateVacancyMatchSchema,
        },
      },
    );

    const parsed = result.object as CandidateVacancyMatch | undefined;
    if (!parsed) {
      if (usageContext) {
        await recordAiUsage({
          ...usageContext,
          model: "gemini-2.5-flash",
          agent: "candidateVacancyMatch",
          operation,
          status: "failed",
          usage: result.totalUsage ?? result.usage,
          errorMessage: "AI вернул пустой structured output для match score",
        });
      }
      return {
        status: "failed",
        errorMessage: "AI вернул пустой structured output для match score",
      };
    }

    const score = clampScore(parsed.score);
    const analysis = {
      ru: parsed.analysis.ru.trim().slice(0, 5000),
      en: parsed.analysis.en.trim().slice(0, 5000),
      uz: parsed.analysis.uz.trim().slice(0, 5000),
    };
    const matchedRequirements = {
      ru: normalizeAiTags(parsed.matchedRequirements.ru, { maxTags: 6 }),
      en: normalizeAiTags(parsed.matchedRequirements.en, { maxTags: 6 }),
      uz: normalizeAiTags(parsed.matchedRequirements.uz, { maxTags: 6 }),
    };
    const missingRequirements = {
      ru: normalizeAiTags(parsed.missingRequirements.ru, { maxTags: 6 }),
      en: normalizeAiTags(parsed.missingRequirements.en, { maxTags: 6 }),
      uz: normalizeAiTags(parsed.missingRequirements.uz, { maxTags: 6 }),
    };

    if (usageContext) {
      await recordAiUsage({
        ...usageContext,
        model: "gemini-2.5-flash",
        agent: "candidateVacancyMatch",
        operation,
        status: "success",
        usage: result.totalUsage ?? result.usage,
      });
    }

    return {
      status: "success",
      score,
      analysis,
      matchedRequirements,
      missingRequirements,
    };
  } catch (error) {
    console.error("Failed to generate candidate-vacancy match", error);
    if (usageContext) {
      await recordAiUsage({
        ...usageContext,
        model: "gemini-2.5-flash",
        agent: "candidateVacancyMatch",
        operation,
        status: "failed",
        usage: null,
        errorMessage:
          error instanceof Error
            ? error.message
            : "Не удалось рассчитать соответствие кандидата вакансии",
      });
    }
    return {
      status: "failed",
      errorMessage:
        error instanceof Error
          ? error.message
          : "Не удалось рассчитать соответствие кандидата вакансии",
    };
  }
}
