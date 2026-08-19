import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { env } from "~/env";
import { db } from "~/server/db";
import { getCompanyFeatures } from "~/server/services/feature-flags";
import {
  handlePostedCallback,
  handleTelegramStart,
  isPostedCallback,
} from "~/server/services/telegram-channel-admins";
import {
  getTelegramResumeConfigForChat,
  getTelegramResumeWebhookSecret,
} from "~/server/services/telegram-resume/config";
import { resolveTelegramDirectResumeTarget } from "~/server/services/telegram-resume/direct-message";
import {
  enqueueTelegramResumeDocument,
  enqueueTelegramResumeUpdate,
} from "~/server/services/telegram-resume/ingestion";

export const runtime = "nodejs";

const telegramDocumentSchema = z.object({
  file_id: z.string().min(1).max(255),
  file_unique_id: z.string().min(1).max(255),
  file_name: z.string().max(255).optional(),
  mime_type: z.string().max(255).optional(),
  file_size: z.number().int().positive().optional(),
});

const telegramUserSchema = z.object({
  id: z.number().int(),
  username: z.string().max(255).optional(),
});

const telegramMessageSchema = z.object({
  message_id: z.number().int().positive(),
  date: z.number().int().nonnegative(),
  chat: z.object({
    id: z.number().int(),
    type: z.enum(["private", "group", "supergroup", "channel"]),
    title: z.string().optional(),
  }),
  from: telegramUserSchema.optional(),
  text: z.string().max(4096).optional(),
  caption: z.string().max(4096).optional(),
  document: telegramDocumentSchema.optional(),
});

/** Button presses from channel admins confirming they published a vacancy. */
const telegramCallbackQuerySchema = z.object({
  id: z.string().min(1).max(255),
  from: telegramUserSchema,
  data: z.string().max(64).optional(),
});

const telegramUpdateSchema = z.object({
  update_id: z.number().int().nonnegative(),
  message: telegramMessageSchema.optional(),
  channel_post: telegramMessageSchema.optional(),
  callback_query: telegramCallbackQuerySchema.optional(),
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
  if (!env.TELEGRAM_BOT_TOKEN) {
    return NextResponse.json(
      { error: "telegram_resume_ingestion_not_configured" },
      { status: 503 },
    );
  }

  if (
    !secretsMatch(
      request.headers.get("x-telegram-bot-api-secret-token"),
      getTelegramResumeWebhookSecret(),
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

  const update = parsed.data;

  // Channel-admin traffic shares this webhook because Telegram allows only one
  // per bot. Both branches return 200 on success so Telegram stops retrying.
  try {
    const callback = update.callback_query;
    if (callback?.data && isPostedCallback(callback.data)) {
      const result = await handlePostedCallback({
        db,
        callbackQueryId: callback.id,
        fromId: callback.from.id,
        data: callback.data,
      });
      return NextResponse.json({ ok: true, outcome: result.outcome });
    }

    // `/start` is the only moment an admin's numeric id becomes known.
    const message = update.message;
    if (
      message?.chat.type === "private" &&
      message.from &&
      message.text?.startsWith("/start")
    ) {
      const result = await handleTelegramStart({
        db,
        fromId: message.from.id,
        username: message.from.username,
      });
      return NextResponse.json({ ok: true, outcome: result.outcome });
    }
  } catch (error) {
    console.error("Failed to handle Telegram channel-admin update", error);
    return NextResponse.json({ error: "admin_update_failed" }, { status: 500 });
  }

  // Resume documents are routed to a company by the chat they were posted
  // in — each company brings its own Telegram group. Unknown chats and
  // non-document updates are acked so Telegram stops retrying.
  const resumeMessage = update.message ?? update.channel_post;
  if (!resumeMessage?.document) {
    return NextResponse.json({ ok: true, outcome: "irrelevant" });
  }

  // Private documents are tenant-scoped through an activated channel-admin
  // record. A valid caption keyword selects the published vacancy's parent;
  // otherwise a one-company admin is routed to that company's warehouse.
  if (resumeMessage.chat.type === "private") {
    if (!resumeMessage.from) {
      return NextResponse.json({ ok: true, outcome: "admin_not_linked" });
    }

    const target = await resolveTelegramDirectResumeTarget({
      db,
      telegramUserId: String(resumeMessage.from.id),
      caption: resumeMessage.caption,
    });
    if (target.outcome !== "resolved") {
      return NextResponse.json({ ok: true, outcome: target.outcome });
    }

    const features = await getCompanyFeatures(db, target.companyId);
    if (!features.canUseTelegramWarehouse) {
      return NextResponse.json({ ok: true, outcome: "feature_disabled" });
    }

    try {
      const document = resumeMessage.document;
      const result = await enqueueTelegramResumeDocument(db, {
        companyId: target.companyId,
        vacancyId: target.vacancyId,
        chatId: String(resumeMessage.chat.id),
        messageId: resumeMessage.message_id,
        updateId: String(update.update_id),
        source: "bot",
        document: {
          fileId: document.file_id,
          fileUniqueId: document.file_unique_id,
          fileName: document.file_name,
          mimeType: document.mime_type,
          fileSize: document.file_size,
        },
        messageDate: new Date(resumeMessage.date * 1000),
      });
      return NextResponse.json({
        ok: true,
        outcome: result.outcome,
        destination: target.destination,
      });
    } catch (error) {
      console.error("Failed to enqueue private Telegram resume", error);
      return NextResponse.json({ error: "enqueue_failed" }, { status: 500 });
    }
  }

  const config = await getTelegramResumeConfigForChat(
    db,
    String(resumeMessage.chat.id),
  );
  if (!config) {
    return NextResponse.json({ ok: true, outcome: "unknown_chat" });
  }

  // Gate only the resume-enqueue branch: the channel-admin branches above must
  // keep working for every company. 200 so Telegram stops retrying.
  const features = await getCompanyFeatures(db, config.companyId);
  if (!features.canUseTelegramWarehouse) {
    return NextResponse.json({ ok: true, outcome: "feature_disabled" });
  }

  try {
    const result = await enqueueTelegramResumeUpdate({
      db,
      config,
      update,
    });
    return NextResponse.json({ ok: true, outcome: result.outcome });
  } catch (error) {
    console.error("Failed to enqueue Telegram resume update", error);
    // A non-2xx response asks Telegram to retry its at-least-once delivery.
    return NextResponse.json({ error: "enqueue_failed" }, { status: 500 });
  }
}
