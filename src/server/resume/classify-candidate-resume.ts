import { mastra } from "~/mastra";
import {
  type CandidateResumeClassification,
  candidateResumeClassificationSchema,
} from "~/schemas/candidate-resume-classification";
import { recordAiUsage } from "~/server/ai/usage-logging";

type Database = typeof import("~/server/db").db;

type AiUsageContext = {
  db: Database;
  userId?: string | null;
  companyId?: string | null;
  candidateId?: string | null;
  operation?: string;
};

export type CandidateResumeClassificationResult =
  | ({ status: "success" } & CandidateResumeClassification)
  | { status: "failed"; errorMessage: string };

export async function classifyCandidateResume(input: {
  fileBuffer: Buffer;
  fileName: string;
  usageContext?: AiUsageContext;
}): Promise<CandidateResumeClassificationResult> {
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

  const operation =
    input.usageContext?.operation ?? "candidate_resume_classification";

  try {
    const agent = mastra.getAgent("candidateResumeClassifier");
    const result = await agent.generate(
      [
        {
          role: "user",
          content: [
            {
              type: "text" as const,
              text: "Определи, является ли этот PDF резюме кандидата.",
            },
            {
              type: "file" as const,
              data: input.fileBuffer,
              mimeType: "application/pdf",
              filename: input.fileName,
            },
          ],
        },
      ],
      { structuredOutput: { schema: candidateResumeClassificationSchema } },
    );

    const parsed = result.object as CandidateResumeClassification | undefined;
    if (!parsed) {
      if (input.usageContext) {
        await recordAiUsage({
          ...input.usageContext,
          model: "gemini-2.5-flash",
          agent: "candidateResumeClassifier",
          operation,
          status: "failed",
          usage: result.totalUsage ?? result.usage,
          errorMessage: "AI вернул пустой результат классификации документа",
        });
      }
      return {
        status: "failed",
        errorMessage: "AI вернул пустой результат классификации документа",
      };
    }

    if (input.usageContext) {
      await recordAiUsage({
        ...input.usageContext,
        model: "gemini-2.5-flash",
        agent: "candidateResumeClassifier",
        operation,
        status: "success",
        usage: result.totalUsage ?? result.usage,
      });
    }

    return {
      status: "success",
      isResume: parsed.isResume,
      reason: parsed.reason.trim().slice(0, 500),
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Не удалось определить тип документа";
    console.error("Failed to classify candidate resume", error);

    if (input.usageContext) {
      await recordAiUsage({
        ...input.usageContext,
        model: "gemini-2.5-flash",
        agent: "candidateResumeClassifier",
        operation,
        status: "failed",
        usage: null,
        errorMessage,
      });
    }

    return { status: "failed", errorMessage };
  }
}
