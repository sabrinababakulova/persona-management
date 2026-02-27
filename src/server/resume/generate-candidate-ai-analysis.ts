import { mastra } from "~/mastra";

export type CandidateAiAnalysisStatus = "success" | "failed";

export type CandidateAiAnalysisResult = {
  text: string;
  status: CandidateAiAnalysisStatus;
  errorMessage?: string;
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

export async function generateCandidateAiAnalysis({
  fileBuffer,
  fileName,
}: {
  fileBuffer: Buffer;
  fileName: string;
}): Promise<CandidateAiAnalysisResult> {
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

    const result = await resumeSummaryAgent.generate([
      {
        role: "user",
        content: [
          {
            type: "text",
            text: prompt,
          },
          {
            type: "file",
            data: fileBuffer,
            mimeType: "application/pdf",
            filename: fileName,
          },
        ],
      },
    ]);

    const rawText = typeof result.text === "string" ? result.text : "";
    const normalizedText = truncateToWordLimit(rawText, MAX_ANALYSIS_WORDS);

    if (!normalizedText) {
      return {
        text: "",
        status: "failed",
        errorMessage: "AI вернул пустой текст для резюме-анализа",
      };
    }

    return {
      text: normalizedText,
      status: "success",
    };
  } catch (error) {
    console.error("Failed to generate candidate AI analysis", error);
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
