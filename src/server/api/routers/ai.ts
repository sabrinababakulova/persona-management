import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { paraphraseText } from "~/server/ai/paraphrase-text";
import { getRequiredCompanyId } from "~/server/api/router-utils/company";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

const MAX_PARAPHRASE_INPUT_LENGTH = 30000;

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
