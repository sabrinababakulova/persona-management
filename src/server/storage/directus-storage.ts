import {
  createDirectus,
  deleteFile,
  readAssetArrayBuffer,
  rest,
  staticToken,
  uploadFiles,
} from "@directus/sdk";

import { env } from "~/env";

const directusInternalUrl = env.DIRECTUS_INTERNAL_URL ?? env.DIRECTUS_URL;
const directusPublicUrl = env.DIRECTUS_PUBLIC_URL ?? env.DIRECTUS_URL;
const directusStorageToken = env.DIRECTUS_STORAGE_TOKEN ?? env.DIRECTUS_TOKEN;

const directus = createDirectus(directusInternalUrl)
  .with(staticToken(directusStorageToken))
  .with(rest());

type DirectusErrorLike = {
  errors?: Array<{ message?: string }>;
  message?: string;
  response?: { status?: number };
  status?: number;
};

export class DirectusStorageError extends Error {
  code: "AUTHENTICATION_FAILED" | "REQUEST_FAILED";
  status?: number;

  constructor(
    message: string,
    code: "AUTHENTICATION_FAILED" | "REQUEST_FAILED",
    options?: { cause?: unknown; status?: number },
  ) {
    super(message, { cause: options?.cause });
    this.name = "DirectusStorageError";
    this.code = code;
    this.status = options?.status;
  }
}

type UploadFileToDirectusParams = {
  existingFileId?: string | null;
  fileBuffer: Buffer;
  fileName: string;
  folder?: string;
  mimeType: string;
  title?: string;
};

function getDirectusStatus(error: unknown) {
  if (!error || typeof error !== "object") {
    return undefined;
  }

  const directusError = error as DirectusErrorLike;

  if (typeof directusError.status === "number") {
    return directusError.status;
  }

  if (typeof directusError.response?.status === "number") {
    return directusError.response.status;
  }

  return undefined;
}

function getDirectusMessages(error: unknown) {
  if (!error || typeof error !== "object") {
    return [];
  }

  const directusError = error as DirectusErrorLike;
  const messages = new Set<string>();

  if (typeof directusError.message === "string" && directusError.message) {
    messages.add(directusError.message);
  }

  for (const nestedError of directusError.errors ?? []) {
    if (typeof nestedError.message === "string" && nestedError.message) {
      messages.add(nestedError.message);
    }
  }

  return [...messages];
}

function isDirectusAuthenticationError(error: unknown) {
  const status = getDirectusStatus(error);
  if (status === 401 || status === 403) {
    return true;
  }

  return getDirectusMessages(error).some((message) =>
    message.toLowerCase().includes("invalid user credentials"),
  );
}

function toDirectusStorageError(error: unknown, fallbackMessage: string) {
  if (error instanceof DirectusStorageError) {
    return error;
  }

  const status = getDirectusStatus(error);

  if (isDirectusAuthenticationError(error)) {
    return new DirectusStorageError(
      "Не удалось авторизоваться в Directus. Проверьте DIRECTUS_STORAGE_TOKEN или DIRECTUS_TOKEN.",
      "AUTHENTICATION_FAILED",
      { cause: error, status },
    );
  }

  return new DirectusStorageError(fallbackMessage, "REQUEST_FAILED", {
    cause: error,
    status,
  });
}

export function buildDirectusAssetUrl(fileId: string) {
  return `${directusPublicUrl}/assets/${fileId}`;
}

export function getDirectusAssetUrl(fileId?: string | null) {
  return fileId ? buildDirectusAssetUrl(fileId) : null;
}

export function isDirectusNotFoundError(error: unknown) {
  if (error instanceof DirectusStorageError) {
    return error.status === 404;
  }

  return getDirectusStatus(error) === 404;
}

export async function deleteDirectusFileById(fileId: string) {
  try {
    await directus.request(deleteFile(fileId));
  } catch (error) {
    throw toDirectusStorageError(
      error,
      "Не удалось удалить существующий файл из Directus.",
    );
  }
}

export async function uploadFileToDirectus({
  existingFileId,
  fileBuffer,
  fileName,
  folder = env.DIRECTUS_FOLDER,
  mimeType,
  title,
}: UploadFileToDirectusParams) {
  try {
    if (existingFileId) {
      await deleteDirectusFileById(existingFileId);
    }

    const formData = new FormData();
    if (title) {
      formData.append("title", title);
    }
    formData.append(
      "file",
      new Blob([new Uint8Array(fileBuffer)], {
        type: mimeType || "application/octet-stream",
      }),
      fileName,
    );

    if (folder) {
      formData.append("folder", folder);
    }

    const result = await directus.request(uploadFiles(formData));
    const fileId = (result as { id: string }).id;

    return {
      fileId,
      title: title ?? "",
    };
  } catch (error) {
    throw toDirectusStorageError(
      error,
      "Не удалось загрузить файл в Directus.",
    );
  }
}

export async function readDirectusAssetArrayBuffer(fileId: string) {
  try {
    return await directus.request(readAssetArrayBuffer(fileId));
  } catch (error) {
    throw toDirectusStorageError(error, "Не удалось скачать файл из Directus.");
  }
}
