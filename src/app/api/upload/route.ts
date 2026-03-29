import { eq } from "drizzle-orm";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { users } from "~/server/db/schema";
import {
  DirectusStorageError,
  uploadFileToDirectus,
} from "~/server/storage/directus-storage";

export const runtime = "nodejs";

const USER_ID_PATH_SAFE_PATTERN = /^[A-Za-z0-9-]+$/;

function getUserAvatarStorageKey(userId: string) {
  if (!USER_ID_PATH_SAFE_PATTERN.test(userId)) {
    throw new Error("Invalid user id for storage key");
  }

  return `users/${userId}/avatar`;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Не авторизован" }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return Response.json(
      { error: "Файл не найден в поле file" },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const key = getUserAvatarStorageKey(session.user.id);
  const [user] = await db
    .select({ avatarFileId: users.avatarFileId })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  try {
    const result = await uploadFileToDirectus({
      existingFileId: user?.avatarFileId ?? null,
      fileBuffer: buffer,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      title: key,
    });

    return Response.json({
      fileId: result.fileId,
    });
  } catch (err) {
    console.error("Upload to Directus failed:", err);
    const message =
      err instanceof DirectusStorageError
        ? err.message
        : "Не удалось загрузить файл";
    const status =
      err instanceof DirectusStorageError &&
      err.code === "AUTHENTICATION_FAILED"
        ? 502
        : 500;

    return Response.json({ error: message }, { status });
  }
}
