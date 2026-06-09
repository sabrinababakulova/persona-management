import { and, eq } from "drizzle-orm";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { candidates } from "~/server/db/schema";
import {
  fetchHhResumePdf,
  HhApiError,
  isHhAccessError,
} from "~/server/services/hh";
import {
  resolveCompanyHhAccounts,
  resolveUserHhAuth,
} from "~/server/services/hh-company-account";
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

/**
 * hh.uz resume id behind a candidate row.
 *
 * Candidates discovered by sync carry it in `hhResumeId`; legacy/import rows
 * encode it in the `hh_<resumeId>` primary key. Returns "" for non-hh.uz rows.
 */
function resolveHhResumeId(candidate: {
  id: string;
  hhResumeId: string | null;
}) {
  const stored = candidate.hhResumeId?.trim();
  if (stored) {
    return stored;
  }

  return candidate.id.startsWith("hh_") ? candidate.id.slice(3) : "";
}

/**
 * Every hh.uz access token usable to download this resume, current user first.
 *
 * A resume may have been imported by a colleague, so we fall back to the other
 * employer accounts connected within the company. Tokens are deduped so the
 * same account connected twice is only tried once.
 */
async function collectHhAccessTokens(userId: string, companyId: string) {
  const tokens: string[] = [];
  const seen = new Set<string>();

  const push = (token?: string | null) => {
    const value = token?.trim();
    if (value && !seen.has(value)) {
      seen.add(value);
      tokens.push(value);
    }
  };

  const userAuth = await resolveUserHhAuth(db, userId);
  push(userAuth?.accessToken);

  const companyAccounts = await resolveCompanyHhAccounts(db, companyId);
  for (const account of companyAccounts) {
    push(account.accessToken);
  }

  return tokens;
}

/**
 * Streams an hh.uz resume PDF to the browser without persisting it.
 *
 * Tries each connected employer token until one is allowed to download the
 * resume. Access denials (403/404) move on to the next token; the daily
 * view-limit (429) is surfaced as-is so the recruiter knows to retry later.
 */
async function streamHhResumePdf(input: {
  candidateId: string;
  resumeId: string;
  userId: string;
  companyId: string;
}) {
  const accessTokens = await collectHhAccessTokens(
    input.userId,
    input.companyId,
  );

  if (accessTokens.length === 0) {
    return buildErrorResponse("Аккаунт hh.uz не подключён", 412);
  }

  let lastError: unknown = null;

  for (const accessToken of accessTokens) {
    try {
      const pdf = await fetchHhResumePdf(input.resumeId, accessToken);

      return new Response(pdf.body, {
        status: 200,
        headers: {
          "Content-Type": pdf.contentType,
          "Content-Disposition": buildContentDisposition(
            sanitizeResumeFileName(pdf.fileName),
          ),
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch (error) {
      lastError = error;
      // This account can't see the resume — another colleague's account might.
      if (isHhAccessError(error)) {
        continue;
      }
      // Any other failure (rate limit, network) won't improve by retrying.
      break;
    }
  }

  if (lastError instanceof HhApiError && lastError.status === 429) {
    return buildErrorResponse(
      "Превышен дневной лимит просмотров резюме на hh.uz",
      429,
    );
  }

  if (isHhAccessError(lastError)) {
    return buildErrorResponse("Резюме недоступно на hh.uz", 404);
  }

  console.error("Failed to stream hh.uz resume", {
    candidateId: input.candidateId,
    resumeId: input.resumeId,
    error: lastError,
  });
  return buildErrorResponse("Не удалось получить резюме с hh.uz", 502);
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
      hhResumeId: candidates.hhResumeId,
    })
    .from(candidates)
    .where(
      and(eq(candidates.id, candidateId), eq(candidates.companyId, companyId)),
    )
    .limit(1);

  if (!candidate) {
    return buildErrorResponse("Кандидат не найден", 404);
  }

  // No uploaded file of our own: for hh.uz-sourced candidates, stream the
  // resume PDF straight from hh.uz without ever writing it to our storage.
  if (!candidate.resumeFileId) {
    const resumeId = resolveHhResumeId(candidate);
    if (resumeId) {
      return streamHhResumePdf({
        candidateId,
        resumeId,
        userId: session.user.id,
        companyId,
      });
    }

    return buildErrorResponse("Резюме не найдено", 404);
  }

  try {
    getCandidateResumeStorageKey(candidateId);
  } catch {
    return buildErrorResponse("Некорректный идентификатор кандидата", 400);
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
