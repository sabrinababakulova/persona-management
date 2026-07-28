import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "~/server/db";
import { getTelegramResumeConfig } from "~/server/services/telegram-resume/config";
import { enqueueTelegramResumeUpdate } from "~/server/services/telegram-resume/ingestion";

export const runtime = "nodejs";

const telegramDocumentSchema = z.object({
  file_id: z.string().min(1).max(255),
  file_unique_id: z.string().min(1).max(255),
  file_name: z.string().max(255).optional(),
  mime_type: z.string().max(255).optional(),
  file_size: z.number().int().positive().optional(),
});

const telegramMessageSchema = z.object({
  message_id: z.number().int().positive(),
  date: z.number().int().nonnegative(),
  chat: z.object({
    id: z.number().int(),
    type: z.enum(["private", "group", "supergroup", "channel"]),
    title: z.string().optional(),
  }),
  document: telegramDocumentSchema.optional(),
});

const telegramUpdateSchema = z.object({
  update_id: z.number().int().nonnegative(),
  message: telegramMessageSchema.optional(),
  channel_post: telegramMessageSchema.optional(),
});

function secretsMatch(received: string | null, expected: string) {
  if (!received) {
    return false;
  }

  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  return (
    receivedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(receivedBuffer, expectedBuffer)
  );
}

export async function POST(request: Request) {
  const config = getTelegramResumeConfig();
  if (!config) {
    return NextResponse.json(
      { error: "telegram_resume_ingestion_not_configured" },
      { status: 503 },
    );
  }

  if (
    !secretsMatch(
      request.headers.get("x-telegram-bot-api-secret-token"),
      config.webhookSecret,
    )
  ) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = telegramUpdateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_update" }, { status: 400 });
  }

  try {
    const result = await enqueueTelegramResumeUpdate({
      db,
      config,
      update: parsed.data,
    });
    return NextResponse.json({ ok: true, outcome: result.outcome });
  } catch (error) {
    console.error("Failed to enqueue Telegram resume update", error);
    // A non-2xx response asks Telegram to retry its at-least-once delivery.
    return NextResponse.json({ error: "enqueue_failed" }, { status: 500 });
  }
}
