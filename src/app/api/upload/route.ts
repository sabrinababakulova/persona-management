import { createDirectus, rest, staticToken, uploadFiles } from "@directus/sdk";

import { env } from "~/env";
import { auth } from "~/server/auth";

export const runtime = "nodejs";

const directusInternalUrl = env.DIRECTUS_INTERNAL_URL ?? env.DIRECTUS_URL;
const directusPublicUrl = env.DIRECTUS_PUBLIC_URL ?? env.DIRECTUS_URL;
const directusStorageToken = env.DIRECTUS_STORAGE_TOKEN ?? env.DIRECTUS_TOKEN;

const directus = createDirectus(directusInternalUrl)
  .with(staticToken(directusStorageToken))
  .with(rest());

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return new Response("file field is required", { status: 400 });
  }

  const key = `${Date.now()}-${file.name}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const uploadForm = new FormData();
  uploadForm.append("title", key);
  uploadForm.append(
    "file",
    new Blob([buffer], { type: file.type || "application/octet-stream" }),
    file.name,
  );

  if (env.DIRECTUS_FOLDER) {
    uploadForm.append("folder", env.DIRECTUS_FOLDER);
  }

  try {
    const result = await directus.request(uploadFiles(uploadForm));
    const fileId = (result as { id: string }).id;
    const publicUrl = `${directusPublicUrl}/assets/${fileId}`;

    return Response.json({ key, fileId, publicUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return new Response(message, { status: 500 });
  }
}
