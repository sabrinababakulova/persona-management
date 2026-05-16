import { TRPCError } from "@trpc/server";

import { DirectusStorageError, uploadFileToDirectus } from "./directus-storage";

/** Image MIME types accepted by every image upload endpoint. */
export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export type AllowedImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

/** Maximum accepted image size, in bytes (5 MB). */
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

export type UploadImageParams = {
  /** Base64-encoded file contents, without a `data:` URL prefix. */
  dataBase64: string;
  fileName: string;
  mimeType: string;
  /** Optional human-readable title / storage key stored on the Directus asset. */
  title?: string;
  /** Optional Directus folder id to place the asset into. */
  folder?: string;
};

export type UploadImageResult = {
  fileId: string;
  title: string;
};

function isAllowedImageMimeType(value: string): value is AllowedImageMimeType {
  return (ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(value);
}

/**
 * Validates and uploads an image to Directus.
 *
 * Shared by every image upload entry point (avatars, and future endpoints): it enforces the
 * allowed MIME types and size limit, decodes the base64 payload, and normalizes Directus
 * failures into {@link TRPCError}s so callers can surface them directly.
 *
 * This always creates a new asset. Replacing/cleaning up a previous file is the caller's
 * responsibility — see `profile.updateAvatar`, where that behavior is avatar-specific.
 */
export async function uploadImage({
  dataBase64,
  fileName,
  mimeType,
  title,
  folder,
}: UploadImageParams): Promise<UploadImageResult> {
  if (!isAllowedImageMimeType(mimeType)) {
    throw new TRPCError({
      code: "UNSUPPORTED_MEDIA_TYPE",
      message: "Допустимые форматы: JPEG, PNG, WebP, GIF",
    });
  }

  const fileBuffer = Buffer.from(dataBase64, "base64");

  if (fileBuffer.byteLength === 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Файл пуст или поврежден",
    });
  }

  if (fileBuffer.byteLength > MAX_IMAGE_SIZE_BYTES) {
    throw new TRPCError({
      code: "PAYLOAD_TOO_LARGE",
      message: "Максимальный размер файла — 5 МБ",
    });
  }

  try {
    return await uploadFileToDirectus({
      fileBuffer,
      fileName,
      mimeType,
      title,
      folder,
    });
  } catch (error) {
    console.error("Image upload to Directus failed:", error);

    const message =
      error instanceof DirectusStorageError
        ? error.message
        : "Не удалось загрузить файл";

    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
  }
}
