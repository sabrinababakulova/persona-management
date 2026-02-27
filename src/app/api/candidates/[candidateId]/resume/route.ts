import { readFile, writeFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { candidates } from "~/server/db/schema";
import {
  buildCandidateResumeUrl,
  ensureCandidateResumeDirectory,
  formatFileSize,
  getCandidateResumeFilePath,
  isSupportedResumeFile,
  MAX_RESUME_FILE_SIZE_BYTES,
  sanitizeResumeFileName,
} from "~/server/storage/resume-storage";

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

  const { candidateId } = await context.params;

  const [candidate] = await db
    .select({ id: candidates.id })
    .from(candidates)
    .where(eq(candidates.id, candidateId))
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

  if (!isSupportedResumeFile(uploadedFile)) {
    return buildErrorResponse("Поддерживаются только PDF-файлы", 415);
  }

  const resumePath = (() => {
    try {
      return getCandidateResumeFilePath(candidateId);
    } catch {
      return null;
    }
  })();

  if (!resumePath) {
    return buildErrorResponse("Некорректный идентификатор кандидата", 400);
  }

  try {
    await ensureCandidateResumeDirectory(candidateId);

    const fileBuffer = Buffer.from(await uploadedFile.arrayBuffer());
    await writeFile(resumePath, fileBuffer);
  } catch (error) {
    console.error("Failed to save candidate resume file", error);
    return buildErrorResponse("Не удалось сохранить файл", 500);
  }

  const resumeFileName = sanitizeResumeFileName(uploadedFile.name);
  const resumeFileSize = formatFileSize(uploadedFile.size);
  const resumeUrl = buildCandidateResumeUrl(candidateId);

  await db
    .update(candidates)
    .set({
      resumeUrl,
      resumeFileName,
      resumeFileSize,
    })
    .where(eq(candidates.id, candidateId));

  return Response.json({
    candidateId,
    resumeUrl,
    resumeFileName,
    resumeFileSize,
  });
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return buildErrorResponse("Не авторизован", 401);
  }

  const { candidateId } = await context.params;

  const [candidate] = await db
    .select({
      id: candidates.id,
      resumeFileName: candidates.resumeFileName,
    })
    .from(candidates)
    .where(eq(candidates.id, candidateId))
    .limit(1);

  if (!candidate) {
    return buildErrorResponse("Кандидат не найден", 404);
  }

  const resumePath = (() => {
    try {
      return getCandidateResumeFilePath(candidateId);
    } catch {
      return null;
    }
  })();

  if (!resumePath) {
    return buildErrorResponse("Некорректный идентификатор кандидата", 400);
  }

  const fileBuffer = await readFile(resumePath).catch(() => null);
  if (!fileBuffer) {
    return buildErrorResponse("Резюме не найдено", 404);
  }

  const downloadFileName = sanitizeResumeFileName(
    candidate.resumeFileName ?? "resume.pdf",
  );

  return new Response(fileBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": buildContentDisposition(downloadFileName),
      "Content-Length": String(fileBuffer.byteLength),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
