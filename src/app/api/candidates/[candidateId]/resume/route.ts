import { and, eq } from "drizzle-orm";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { candidates } from "~/server/db/schema";
import {
  DirectusStorageError,
  isDirectusNotFoundError,
} from "~/server/storage/directus-storage";
import {
  buildCandidateResumeUrl,
  downloadCandidateResumeFromStorage,
  formatFileSize,
  getCandidateResumeStorageKey,
  hasPdfEofMarker,
  hasPdfExtension,
  hasPdfMagicHeader,
  isAllowedPdfMimeType,
  MAX_RESUME_FILE_SIZE_BYTES,
  sanitizeResumeFileName,
  uploadCandidateResumeToStorage,
} from "~/server/storage/resume-storage";
import { getUserCompanyId } from "~/server/utils/get-user-company-id";

type RouteContext = {
  params: Promise<{ candidateId: string }>;
};

function buildErrorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

function buildContentDisposition(fileName: string) {
  const fallbackFileName = "resume.pdf";
  return `attachment; filename="${fallbackFileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export async function POST(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return buildErrorResponse("Не авторизован", 401);
  }

  const companyId = await getUserCompanyId(db, session.user.id);
  if (!companyId) {
    return buildErrorResponse("У вас не привязана компания", 412);
  }

  const { candidateId } = await context.params;

  const [candidate] = await db
    .select({
      id: candidates.id,
      resumeFileId: candidates.resumeFileId,
    })
    .from(candidates)
    .where(
      and(eq(candidates.id, candidateId), eq(candidates.companyId, companyId)),
    )
    .limit(1);

  if (!candidate) {
    return buildErrorResponse("Кандидат не найден", 404);
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return buildErrorResponse("Некорректный multipart-запрос", 400);
  }

  const uploadedFile = formData.get("file");
  if (!(uploadedFile instanceof File)) {
    return buildErrorResponse("Файл не найден в поле file", 400);
  }

  if (uploadedFile.size <= 0) {
    return buildErrorResponse("Файл пустой", 400);
  }

  if (uploadedFile.size > MAX_RESUME_FILE_SIZE_BYTES) {
    return buildErrorResponse("Файл слишком большой. Максимум 10MB.", 413);
  }

  try {
    getCandidateResumeStorageKey(candidateId);
  } catch {
    return buildErrorResponse("Некорректный идентификатор кандидата", 400);
  }

  try {
    const fileBuffer = Buffer.from(await uploadedFile.arrayBuffer());
    if (!hasPdfExtension(uploadedFile.name)) {
      return buildErrorResponse(
        "Недопустимое расширение файла. Разрешены только PDF.",
        415,
      );
    }

    if (!isAllowedPdfMimeType(uploadedFile.type)) {
      return buildErrorResponse(
        "Недопустимый MIME-тип файла. Разрешен только application/pdf.",
        415,
      );
    }

    if (!hasPdfMagicHeader(fileBuffer) || !hasPdfEofMarker(fileBuffer)) {
      return buildErrorResponse("Файл не является валидным PDF", 415);
    }

    const uploadResult = await uploadCandidateResumeToStorage(
      candidateId,
      fileBuffer,
      candidate.resumeFileId ?? null,
      uploadedFile.type || "application/pdf",
    );

    const resumeFileName = sanitizeResumeFileName(uploadedFile.name);
    const resumeFileSize = formatFileSize(uploadedFile.size);
    const resumeDownloadUrl = buildCandidateResumeUrl(candidateId);

    await db
      .update(candidates)
      .set({
        resumeFileId: uploadResult.fileId,
        resumeFileName,
        resumeFileSize,
      })
      .where(eq(candidates.id, candidateId));

    return Response.json({
      candidateId,
      resumeDownloadUrl,
      resumeFileId: uploadResult.fileId,
      resumeFileName,
      resumeFileSize,
    });
  } catch (error) {
    console.error("Failed to save candidate resume file", error);
    return buildErrorResponse(
      error instanceof DirectusStorageError
        ? error.message
        : "Не удалось сохранить файл",
      500,
    );
  }
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return buildErrorResponse("Не авторизован", 401);
  }

  const companyId = await getUserCompanyId(db, session.user.id);
  if (!companyId) {
    return buildErrorResponse("У вас не привязана компания", 412);
  }

  const { candidateId } = await context.params;

  const [candidate] = await db
    .select({
      id: candidates.id,
      resumeFileId: candidates.resumeFileId,
      resumeFileName: candidates.resumeFileName,
    })
    .from(candidates)
    .where(
      and(eq(candidates.id, candidateId), eq(candidates.companyId, companyId)),
    )
    .limit(1);

  if (!candidate) {
    return buildErrorResponse("Кандидат не найден", 404);
  }

  try {
    getCandidateResumeStorageKey(candidateId);
  } catch {
    return buildErrorResponse("Некорректный идентификатор кандидата", 400);
  }

  if (!candidate.resumeFileId) {
    return buildErrorResponse("Резюме не найдено", 404);
  }

  try {
    const resumeFile = await downloadCandidateResumeFromStorage(
      candidate.resumeFileId,
    );

    const downloadFileName = sanitizeResumeFileName(
      candidate.resumeFileName ?? "resume.pdf",
    );

    return new Response(resumeFile.buffer, {
      status: 200,
      headers: {
        "Content-Type": resumeFile.contentType ?? "application/pdf",
        "Content-Disposition": buildContentDisposition(downloadFileName),
        "Content-Length": String(resumeFile.buffer.byteLength),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (isDirectusNotFoundError(error)) {
      return buildErrorResponse("Резюме не найдено", 404);
    }

    console.error("Failed to download candidate resume file", error);
    return buildErrorResponse(
      error instanceof DirectusStorageError
        ? error.message
        : "Не удалось скачать файл",
      500,
    );
  }
}
