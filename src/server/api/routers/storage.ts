import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {
  ALLOWED_IMAGE_MIME_TYPES,
  uploadImage,
} from "~/server/storage/image-upload";

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
    .mutation(async ({ input }) => {
      const { fileId } = await uploadImage(input);
      return { fileId };
    }),
});
