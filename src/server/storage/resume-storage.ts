import { mkdir } from "node:fs/promises";
import path from "node:path";

import { env } from "~/env";

const DEFAULT_RESUME_STORAGE_PATH = path.resolve(process.cwd(), "storage");
const CANDIDATE_ID_PATH_SAFE_PATTERN = /^[A-Za-z0-9-]+$/;
const PDF_HEADER = Buffer.from("%PDF-", "ascii");
const PDF_EOF_MARKER = Buffer.from("%%EOF", "ascii");
const PDF_EOF_SCAN_BYTES = 2048;

export const MAX_RESUME_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const RESUME_FILE_NAME_ON_DISK = "resume.pdf";

function assertPathSafeCandidateId(candidateId: string) {
  if (!CANDIDATE_ID_PATH_SAFE_PATTERN.test(candidateId)) {
    throw new Error("Invalid candidate id for file storage path");
  }
}

export function getResumeStorageRoot() {
  const configuredStoragePath = env.RESUME_STORAGE_PATH?.trim();
  if (!configuredStoragePath) {
    return DEFAULT_RESUME_STORAGE_PATH;
  }

  return path.isAbsolute(configuredStoragePath)
    ? configuredStoragePath
    : path.resolve(process.cwd(), configuredStoragePath);
}

export function getCandidateResumeDirectory(candidateId: string) {
  assertPathSafeCandidateId(candidateId);
  return path.join(getResumeStorageRoot(), "candidates", candidateId);
}

export function getCandidateResumeFilePath(candidateId: string) {
  return path.join(
    getCandidateResumeDirectory(candidateId),
    RESUME_FILE_NAME_ON_DISK,
  );
}

export async function ensureCandidateResumeDirectory(candidateId: string) {
  await mkdir(getCandidateResumeDirectory(candidateId), { recursive: true });
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
