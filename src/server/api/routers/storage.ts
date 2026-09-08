import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { takeRateLimitSlot } from "~/server/auth/rate-limit";
import {
  ALLOWED_IMAGE_MIME_TYPES,
  uploadImage,
} from "~/server/storage/image-upload";
import { createUploadToken } from "~/server/storage/upload-token";

const UPLOAD_RATE_LIMIT_MAX_REQUESTS = 40;
const UPLOAD_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

export const uploadImageInputSchema = z.object({
  /** Base64-encoded file contents, without a `data:` URL prefix. */
  dataBase64: z.string().min(1),
  fileName: z.string().min(1).max(255),
  mimeType: z.enum(ALLOWED_IMAGE_MIME_TYPES),
  /** Optional human-readable title stored on the Directus asset. */
  title: z.string().max(255).optional(),
});

export const storageRouter = createTRPCRouter({
  /**
   * Validates and stores an image, returning its Directus file id.
   *
   * Generic on purpose: callers (avatar uploads today, other endpoints later) decide what to
   * do with the returned `fileId` — e.g. persist it on a record via a dedicated mutation.
   */
  uploadImage: protectedProcedure
    .input(uploadImageInputSchema)
    .mutation(async ({ ctx, input }) => {
      // Each accepted upload writes up to 5 MB into Directus and is never garbage-collected
      // unless a caller replaces it, so the endpoint is metered per account.
      const allowed = await takeRateLimitSlot(
        `image-upload:${ctx.session.user.id}`,
        UPLOAD_RATE_LIMIT_MAX_REQUESTS,
        UPLOAD_RATE_LIMIT_WINDOW_MS,
      );
      if (!allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Слишком много загрузок. Попробуйте через несколько минут.",
        });
      }

      const { fileId } = await uploadImage(input);
      // The handle proves *this* user uploaded *this* file; the mutations that persist a file
      // id require it, so a caller cannot claim an asset they did not create.
      return {
        fileId,
        uploadToken: createUploadToken(ctx.session.user.id, fileId),
      };
    }),
});
