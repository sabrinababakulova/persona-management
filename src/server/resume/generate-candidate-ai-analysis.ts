import { mastra } from "~/mastra";
import {
  type CandidateResumeSummary,
  candidateResumeSummarySchema,
} from "~/schemas/candidate-resume-summary";
import { recordAiUsage } from "~/server/ai/usage-logging";
import { normalizeAiTags } from "~/shared/ai-tags";
import type { LocalizedText } from "~/shared/localized-ai";

export type CandidateAiAnalysisStatus = "success" | "failed";

type Database = typeof import("~/server/db").db;

type AiUsageContext = {
  db: Database;
  userId?: string | null;
  companyId?: string | null;
  candidateId?: string | null;
  operation?: string;
};

export type CandidateAiAnalysisResult = {
  text: string;
  translations?: LocalizedText;
  tags?: string[];
  status: CandidateAiAnalysisStatus;
  errorMessage?: string;
};

type CandidateAiAnalysisInput =
  | {
      fileBuffer: Buffer;
      fileName: string;
      resumeText?: never;
      sourceLabel?: never;
    }
  | {
      resumeText: string;
      sourceLabel?: string;
      fileBuffer?: never;
      fileName?: never;
    };

const MAX_ANALYSIS_WORDS = 120;

function normalizeSummary(value: string) {
  return value
    .split("\n")
    .map((line) =>
      line
        .replace(/^[•*-]\s*/, "")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean)
    .join("\n");
}

function truncateToWordLimit(value: string, wordLimit: number) {
  const normalized = normalizeSummary(value);
  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length <= wordLimit) {
    return normalized;
  }

  const lines = normalized.split("\n");
  const wordsPerLine = Math.max(1, Math.floor(wordLimit / lines.length));
  return lines
    .map((line) =>
      line.split(/\s+/).filter(Boolean).slice(0, wordsPerLine).join(" "),
    )
    .join("\n");
}

export async function generateCandidateAiAnalysis(
  input: CandidateAiAnalysisInput,
  usageContext?: AiUsageContext,
): Promise<CandidateAiAnalysisResult> {
  if (
    !process.env.GOOGLE_API_KEY &&
    !process.env.GOOGLE_GENERATIVE_AI_API_KEY
  ) {
    return {
      text: "",
      status: "failed",
      errorMessage:
        "GOOGLE_API_KEY или GOOGLE_GENERATIVE_AI_API_KEY не задан в окружении",
    };
  }

  try {
    const resumeSummaryAgent = mastra.getAgent("candidateResumeSummary");
    const prompt = `Create the recruiter resume brief described in your
instructions. Produce equivalent Russian, English, and Uzbek versions, each no
longer than ${MAX_ANALYSIS_WORDS} words, plus 1–3 factual search tags. Every tag
must be a short label of no more than four words, never a sentence. Use only the
supplied resume.`;
    const resumeText =
      "resumeText" in input ? input.resumeText?.trim() || "" : "";

    const content =
      "resumeText" in input
        ? [
            {
              type: "text" as const,
              text: `${prompt}

Ниже даны структурированные данные кандидата из ${
                input.sourceLabel?.trim() || "резюме"
              }. Используй только эту информацию.

${resumeText}`,
            },
          ]
        : [
            {
              type: "text" as const,
              text: prompt,
            },
            {
              type: "file" as const,
              data: input.fileBuffer,
              mimeType: "application/pdf",
              filename: input.fileName,
            },
          ];

    const result = await resumeSummaryAgent.generate(
      [
        {
          role: "user",
          content,
        },
      ],
      {
        structuredOutput: {
          schema: candidateResumeSummarySchema,
        },
      },
    );

    const parsed = result.object as CandidateResumeSummary | undefined;
    const translations = parsed
      ? {
          ru: truncateToWordLimit(parsed.summaries.ru, MAX_ANALYSIS_WORDS),
          en: truncateToWordLimit(parsed.summaries.en, MAX_ANALYSIS_WORDS),
          uz: truncateToWordLimit(parsed.summaries.uz, MAX_ANALYSIS_WORDS),
        }
      : undefined;
    const normalizedText = translations?.ru ?? "";
    const tags = normalizeAiTags(parsed?.tags);

    if (!normalizedText || !translations?.en || !translations.uz || !tags[0]) {
      if (usageContext) {
        await recordAiUsage({
          ...usageContext,
          model: "gemini-2.5-flash",
          agent: "candidateResumeSummary",
          operation: usageContext.operation ?? "candidate_resume_ai_analysis",
          status: "failed",
          usage: result.totalUsage ?? result.usage,
          errorMessage: "AI вернул неполный резюме-анализ или пустые теги",
        });
      }

      return {
        text: "",
        status: "failed",
        errorMessage: "AI вернул неполный резюме-анализ или пустые теги",
      };
    }

    if (usageContext) {
      await recordAiUsage({
        ...usageContext,
        model: "gemini-2.5-flash",
        agent: "candidateResumeSummary",
        operation: usageContext.operation ?? "candidate_resume_ai_analysis",
        status: "success",
        usage: result.totalUsage ?? result.usage,
      });
    }

    return {
      text: normalizedText,
      translations,
      tags,
      status: "success",
    };
  } catch (error) {
    console.error("Failed to generate candidate AI analysis", error);
    if (usageContext) {
      await recordAiUsage({
        ...usageContext,
        model: "gemini-2.5-flash",
        agent: "candidateResumeSummary",
        operation: usageContext.operation ?? "candidate_resume_ai_analysis",
        status: "failed",
        usage: null,
        errorMessage:
          error instanceof Error
            ? error.message
            : "Не удалось сгенерировать AI-анализ резюме",
      });
    }

    return {
      text: "",
      status: "failed",
      errorMessage:
        error instanceof Error
          ? error.message
          : "Не удалось сгенерировать AI-анализ резюме",
    };
  }
}
