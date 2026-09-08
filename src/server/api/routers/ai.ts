import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { paraphraseText } from "~/server/ai/paraphrase-text";
import { getRequiredCompanyId } from "~/server/api/router-utils/company";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { takeRateLimitSlot } from "~/server/auth/rate-limit";

const MAX_PARAPHRASE_INPUT_LENGTH = 30000;
const PARAPHRASE_RATE_LIMIT_MAX_REQUESTS = 20;
const PARAPHRASE_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

export const paraphraseInputSchema = z.object({
  /** Rich-text HTML from a Tiptap editor. */
  html: z.string().min(1).max(MAX_PARAPHRASE_INPUT_LENGTH),
});

export const aiRouter = createTRPCRouter({
  /**
   * Paraphrases rich-text HTML and returns improved HTML, preserving structure.
   * Used by the AI button inside the shared rich-text editor.
   */
  paraphrase: protectedProcedure
    .input(paraphraseInputSchema)
    .mutation(async ({ ctx, input }) => {
      const companyId = await getRequiredCompanyId(
        ctx.db,
        ctx.session?.user?.id,
      );

      // Each call is a model request of up to 30 000 characters; meter it per account so a
      // loop in a client — or a bored user — cannot run up the bill unbounded.
      const allowed = await takeRateLimitSlot(
        `ai-paraphrase:${ctx.session.user.id}`,
        PARAPHRASE_RATE_LIMIT_MAX_REQUESTS,
        PARAPHRASE_RATE_LIMIT_WINDOW_MS,
      );
      if (!allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message:
            "Слишком много запросов к ИИ. Попробуйте через несколько минут.",
        });
      }

      const result = await paraphraseText(
        { html: input.html },
        {
          db: ctx.db,
          userId: ctx.session?.user?.id,
          companyId,
          operation: "text_paraphrase",
        },
      );

      if (result.status === "failed") {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.errorMessage ?? "Не удалось перефразировать текст",
        });
      }

      return { html: result.html };
    }),
});
