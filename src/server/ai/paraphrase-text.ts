import { mastra } from "~/mastra";
import { recordAiUsage } from "~/server/ai/usage-logging";

export type ParaphraseTextStatus = "success" | "failed";

type Database = typeof import("~/server/db").db;

type AiUsageContext = {
  db: Database;
  userId?: string | null;
  companyId?: string | null;
  operation?: string;
};

export type ParaphraseTextResult = {
  html: string;
  status: ParaphraseTextStatus;
  errorMessage?: string;
};

type ParaphraseTextInput = {
  /** Rich-text HTML coming from the Tiptap editor. */
  html: string;
};

/** Strips a leading/trailing markdown code fence the model may add despite instructions. */
function stripCodeFence(value: string) {
  const trimmed = value.trim();
  const fenceMatch = /^```(?:html)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return (fenceMatch?.[1] ?? trimmed).trim();
}

export async function paraphraseText(
  input: ParaphraseTextInput,
  usageContext?: AiUsageContext,
): Promise<ParaphraseTextResult> {
  if (
    !process.env.GOOGLE_API_KEY &&
    !process.env.GOOGLE_GENERATIVE_AI_API_KEY
  ) {
    return {
      html: "",
      status: "failed",
      errorMessage:
        "GOOGLE_API_KEY или GOOGLE_GENERATIVE_AI_API_KEY не задан в окружении",
    };
  }

  const sourceHtml = input.html.trim();
  if (!sourceHtml) {
    return {
      html: "",
      status: "failed",
      errorMessage: "Нет текста для перефразирования",
    };
  }

  try {
    const paraphraserAgent = mastra.getAgent("textParaphraser");
    const result = await paraphraserAgent.generate([
      {
        role: "user",
        content: [
          {
            type: "text" as const,
            text: `Перефразируй приведённый ниже HTML-текст. Сохрани смысл, факты и структуру, верни только HTML.

${sourceHtml}`,
          },
        ],
      },
    ]);

    const rawText = typeof result.text === "string" ? result.text : "";
    const paraphrasedHtml = stripCodeFence(rawText);

    if (!paraphrasedHtml) {
      if (usageContext) {
        await recordAiUsage({
          ...usageContext,
          model: "gemini-2.5-flash",
          agent: "textParaphraser",
          operation: usageContext.operation ?? "text_paraphrase",
          status: "failed",
          usage: result.totalUsage ?? result.usage,
          errorMessage: "AI вернул пустой текст при перефразировании",
        });
      }

      return {
        html: "",
        status: "failed",
        errorMessage: "AI вернул пустой текст при перефразировании",
      };
    }

    if (usageContext) {
      await recordAiUsage({
        ...usageContext,
        model: "gemini-2.5-flash",
        agent: "textParaphraser",
        operation: usageContext.operation ?? "text_paraphrase",
        status: "success",
        usage: result.totalUsage ?? result.usage,
      });
    }

    return {
      html: paraphrasedHtml,
      status: "success",
    };
  } catch (error) {
    console.error("Failed to paraphrase text", error);
    if (usageContext) {
      await recordAiUsage({
        ...usageContext,
        model: "gemini-2.5-flash",
        agent: "textParaphraser",
        operation: usageContext.operation ?? "text_paraphrase",
        status: "failed",
        usage: null,
        errorMessage:
          error instanceof Error
            ? error.message
            : "Не удалось перефразировать текст",
      });
    }

    return {
      html: "",
      status: "failed",
      errorMessage:
        error instanceof Error
          ? error.message
          : "Не удалось перефразировать текст",
    };
  }
}
