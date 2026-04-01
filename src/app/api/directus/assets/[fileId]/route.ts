import {
  DirectusStorageError,
  fetchDirectusAsset,
  isDirectusNotFoundError,
} from "~/server/storage/directus-storage";

type RouteContext = {
  params: Promise<{ fileId: string }>;
};

function buildErrorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function GET(_request: Request, context: RouteContext) {
  const { fileId } = await context.params;

  if (!/^[A-Za-z0-9-]+$/.test(fileId)) {
    return buildErrorResponse("Некорректный идентификатор файла", 400);
  }

  try {
    const upstreamResponse = await fetchDirectusAsset(fileId);
    const headers = new Headers();

    const contentType = upstreamResponse.headers.get("content-type");
    const contentLength = upstreamResponse.headers.get("content-length");
    const cacheControl = upstreamResponse.headers.get("cache-control");
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

    if (cacheControl) {
      headers.set("Cache-Control", cacheControl);
    }

    if (contentDisposition) {
      headers.set("Content-Disposition", contentDisposition);
    }

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
