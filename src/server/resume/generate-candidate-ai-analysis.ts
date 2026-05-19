import { mastra } from "~/mastra";
import { recordAiUsage } from "~/server/ai/usage-logging";

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

const MAX_ANALYSIS_WORDS = 150;

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function truncateToWordLimit(value: string, wordLimit: number) {
  const words = normalizeWhitespace(value).split(" ").filter(Boolean);
  if (words.length <= wordLimit) {
    return words.join(" ");
  }

  return words.slice(0, wordLimit).join(" ");
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
    const prompt = `
Составь краткую оценку кандидата по резюме для HR-команды.
Требования:
- один абзац;
- максимум ${MAX_ANALYSIS_WORDS} слов;
- только факты из резюме;
- выдели ключевой опыт, релевантные навыки и потенциальные риски/ограничения, если они явно есть в резюме.
`;
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

    const result = await resumeSummaryAgent.generate([
      {
        role: "user",
        content,
      },
    ]);

    const rawText = typeof result.text === "string" ? result.text : "";
    const normalizedText = truncateToWordLimit(rawText, MAX_ANALYSIS_WORDS);

    if (!normalizedText) {
      if (usageContext) {
        await recordAiUsage({
          ...usageContext,
          model: "gemini-2.5-flash",
          agent: "candidateResumeSummary",
          operation: usageContext.operation ?? "candidate_resume_ai_analysis",
          status: "failed",
          usage: result.totalUsage ?? result.usage,
          errorMessage: "AI вернул пустой текст для резюме-анализа",
        });
      }

      return {
        text: "",
        status: "failed",
        errorMessage: "AI вернул пустой текст для резюме-анализа",
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
