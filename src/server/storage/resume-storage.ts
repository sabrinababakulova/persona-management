import {
  readDirectusAssetArrayBuffer,
  uploadFileToDirectus,
} from "~/server/storage/directus-storage";

const CANDIDATE_ID_PATH_SAFE_PATTERN = /^[A-Za-z0-9-]+$/;
const PDF_HEADER = Buffer.from("%PDF-", "ascii");
const PDF_EOF_MARKER = Buffer.from("%%EOF", "ascii");
const PDF_EOF_SCAN_BYTES = 2048;

export const MAX_RESUME_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const RESUME_FILE_NAME_ON_STORAGE = "resume.pdf";

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
  existingResumeFileId: string | null,
  mimeType: string,
) {
  const key = getCandidateResumeStorageKey(candidateId);
  const result = await uploadFileToDirectus({
    existingFileId: existingResumeFileId,
    fileBuffer,
    fileName: RESUME_FILE_NAME_ON_STORAGE,
    mimeType: mimeType || "application/pdf",
    title: key,
  });

  return { fileId: result.fileId };
}

export async function downloadCandidateResumeFromStorage(fileId: string) {
  const arrayBuffer = await readDirectusAssetArrayBuffer(fileId);
  return {
    buffer: Buffer.from(arrayBuffer),
    contentType: "application/pdf",
  };
}
