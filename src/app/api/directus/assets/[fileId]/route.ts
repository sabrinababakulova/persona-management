import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { canUserReadDirectusAsset } from "~/server/storage/asset-access";
import {
  DirectusStorageError,
  fetchDirectusAsset,
  isDirectusNotFoundError,
} from "~/server/storage/directus-storage";
import { getUserCompanyId } from "~/server/utils/get-user-company-id";

type RouteContext = {
  params: Promise<{ fileId: string }>;
};

function buildErrorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

/**
 * Streams a Directus asset to the browser.
 *
 * The upstream fetch uses the server's static Directus token, which can read every file in the
 * instance, so this route — not the token — is the access control. It used to have none at
 * all: a well-formed id was the only requirement, which made every avatar, company logo,
 * publication image and candidate resume readable by anonymous traffic to anyone who saw an id.
 */
export async function GET(_request: Request, context: RouteContext) {
  const { fileId } = await context.params;

  if (!/^[A-Za-z0-9-]+$/.test(fileId)) {
    return buildErrorResponse("Некорректный идентификатор файла", 400);
  }

  const session = await auth();
  if (!session?.user?.id) {
    return buildErrorResponse("Не авторизован", 401);
  }

  const companyId = await getUserCompanyId(db, session.user.id);
  const allowed = await canUserReadDirectusAsset(db, {
    userId: session.user.id,
    companyId,
    fileId,
  });

  // 404 rather than 403: a distinguishable "exists but forbidden" would turn this route back
  // into an oracle for which ids are real.
  if (!allowed) {
    return buildErrorResponse("Файл не найден", 404);
  }

  try {
    const upstreamResponse = await fetchDirectusAsset(fileId);
    const headers = new Headers();

    const contentType = upstreamResponse.headers.get("content-type");
    const contentLength = upstreamResponse.headers.get("content-length");
    const contentDisposition = upstreamResponse.headers.get(
      "content-disposition",
    );
    const etag = upstreamResponse.headers.get("etag");

    if (contentType) {
      headers.set("Content-Type", contentType);
    }

    if (contentLength) {
      headers.set("Content-Length", contentLength);
    }

    // Ignore whatever Directus advertises: these are tenant-scoped files behind a session,
    // so only the requesting browser may keep a copy.
    headers.set("Cache-Control", "private, max-age=0, must-revalidate");

    if (contentDisposition) {
      headers.set("Content-Disposition", contentDisposition);
    }

    headers.set("X-Content-Type-Options", "nosniff");

    if (etag) {
      headers.set("ETag", etag);
    }

    return new Response(upstreamResponse.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    if (isDirectusNotFoundError(error)) {
      return buildErrorResponse("Файл не найден", 404);
    }

    console.error("Failed to proxy Directus asset", error);

    return buildErrorResponse(
      error instanceof DirectusStorageError
        ? error.message
        : "Не удалось получить файл",
      500,
    );
  }
}
