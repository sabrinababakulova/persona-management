import {
  createDirectus,
  deleteFile,
  readAssetArrayBuffer,
  readFiles,
  rest,
  staticToken,
  uploadFiles,
} from "@directus/sdk";

import { env } from "~/env";

const CANDIDATE_ID_PATH_SAFE_PATTERN = /^[A-Za-z0-9-]+$/;
const PDF_HEADER = Buffer.from("%PDF-", "ascii");
const PDF_EOF_MARKER = Buffer.from("%%EOF", "ascii");
const PDF_EOF_SCAN_BYTES = 2048;

export const MAX_RESUME_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const RESUME_FILE_NAME_ON_STORAGE = "resume.pdf";

const directusInternalUrl = env.DIRECTUS_INTERNAL_URL ?? env.DIRECTUS_URL;
const directusPublicUrl = env.DIRECTUS_PUBLIC_URL ?? env.DIRECTUS_URL;
const directusStorageToken = env.DIRECTUS_STORAGE_TOKEN ?? env.DIRECTUS_TOKEN;

const directus = createDirectus(directusInternalUrl)
  .with(staticToken(directusStorageToken))
  .with(rest());

async function findFileByTitle(title: string): Promise<string | null> {
  const files = await directus.request(
    readFiles({
      filter: { title: { _eq: title } },
      fields: ["id"],
      limit: 1,
    }),
  );

  return files[0]?.id ?? null;
}

function assertPathSafeCandidateId(candidateId: string) {
  if (!CANDIDATE_ID_PATH_SAFE_PATTERN.test(candidateId)) {
    throw new Error("Invalid candidate id for storage key");
  }
}

export function getCandidateResumeStorageKey(candidateId: string) {
  assertPathSafeCandidateId(candidateId);
  return `candidates/${candidateId}/${RESUME_FILE_NAME_ON_STORAGE}`;
}

export function buildCandidateResumeUrl(candidateId: string) {
  return `/api/candidates/${candidateId}/resume`;
}

export function sanitizeResumeFileName(fileName: string) {
  const sanitized = fileName
    .trim()
    .replaceAll(/[\\/\0]/g, " ")
    .replaceAll(/\s+/g, " ");

  if (!sanitized) {
    return "resume.pdf";
  }

  return sanitized.length > 255 ? sanitized.slice(0, 255) : sanitized;
}

export function hasPdfExtension(fileName: string) {
  return fileName.trim().toLowerCase().endsWith(".pdf");
}

export function isAllowedPdfMimeType(mimeType: string) {
  const normalized = mimeType.trim().toLowerCase();
  return normalized === "" || normalized === "application/pdf";
}

export function hasPdfMagicHeader(fileBuffer: Buffer) {
  if (fileBuffer.length < PDF_HEADER.length) {
    return false;
  }

  return fileBuffer.subarray(0, PDF_HEADER.length).equals(PDF_HEADER);
}

export function hasPdfEofMarker(fileBuffer: Buffer) {
  if (fileBuffer.length < PDF_EOF_MARKER.length) {
    return false;
  }

  const scanStart = Math.max(0, fileBuffer.length - PDF_EOF_SCAN_BYTES);
  const tail = fileBuffer.subarray(scanStart);

  return tail.includes(PDF_EOF_MARKER);
}

export function formatFileSize(fileSizeBytes: number) {
  if (fileSizeBytes < 1024) {
    return `${fileSizeBytes} B`;
  }

  const sizeKb = fileSizeBytes / 1024;
  if (sizeKb < 1024) {
    return `${Math.round(sizeKb)} KB`;
  }

  const sizeMb = sizeKb / 1024;
  return `${sizeMb.toFixed(1)} MB`;
}

export async function uploadCandidateResumeToStorage(
  candidateId: string,
  fileBuffer: Buffer,
  mimeType: string,
) {
  const key = getCandidateResumeStorageKey(candidateId);

  // Delete existing file if present (upsert behavior)
  const existingId = await findFileByTitle(key);
  if (existingId) {
    await directus.request(deleteFile(existingId));
  }

  const formData = new FormData();
  formData.append("title", key);
  formData.append(
    "file",
    new Blob([new Uint8Array(fileBuffer)], {
      type: mimeType || "application/pdf",
    }),
    RESUME_FILE_NAME_ON_STORAGE,
  );

  if (env.DIRECTUS_FOLDER) {
    formData.append("folder", env.DIRECTUS_FOLDER);
  }

  await directus.request(uploadFiles(formData));

  return { key };
}

export async function downloadCandidateResumeFromStorage(candidateId: string) {
  const key = getCandidateResumeStorageKey(candidateId);

  const fileId = await findFileByTitle(key);
  if (!fileId) return null;

  try {
    const arrayBuffer = await directus.request(readAssetArrayBuffer(fileId));
    return {
      buffer: Buffer.from(arrayBuffer),
      contentType: "application/pdf",
    };
  } catch (err) {
    if (
      err instanceof Error &&
      "status" in err &&
      (err as { status: number }).status === 404
    ) {
      return null;
    }
    throw err;
  }
}

export function buildPublicResumeUrl(key: string) {
  return `${directusPublicUrl}/assets/${key}`;
}
