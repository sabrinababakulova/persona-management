import { createDirectus, rest, staticToken, uploadFiles } from "@directus/sdk";

import { env } from "~/env";

export const runtime = "nodejs";

const directus = createDirectus(env.DIRECTUS_URL ?? "")
  .with(staticToken(env.DIRECTUS_TOKEN ?? ""))
  .with(rest());

export async function POST(req: Request) {
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
    const publicUrl = `${env.DIRECTUS_URL}/assets/${fileId}`;

    return Response.json({ key, fileId, publicUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return new Response(message, { status: 500 });
  }
}
