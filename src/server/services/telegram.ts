import { autoRetry } from "@grammyjs/auto-retry";
import { Api, InputFile } from "grammy";
import type { Message } from "grammy/types";

import { env } from "~/env";

const TELEGRAM_API_ORIGIN = "https://api.telegram.org";
const TELEGRAM_API_RETRY_ATTEMPTS = 2;
const TELEGRAM_API_MAX_RETRY_DELAY_SECONDS = 15;

let telegramApi: Api | null = null;
let cachedBotId: number | null = null;

export function isTelegramConfigured(): boolean {
  return !!env.TELEGRAM_BOT_TOKEN;
}

function requireTelegramToken() {
  if (!env.TELEGRAM_BOT_TOKEN) {
    throw new Error("Telegram bot token is not configured");
  }
  return env.TELEGRAM_BOT_TOKEN;
}

export function createTelegramApi(token: string) {
  const api = new Api(token);
  api.config.use(
    autoRetry({
      maxRetryAttempts: TELEGRAM_API_RETRY_ATTEMPTS,
      maxDelaySeconds: TELEGRAM_API_MAX_RETRY_DELAY_SECONDS,
    }),
  );
  return api;
}

function getTelegramApi() {
  telegramApi ??= createTelegramApi(requireTelegramToken());
  return telegramApi;
}

function parseTelegramSendResult(message: Message): {
  messageId: number;
  messageUrl: string;
} {
  const messageId = message.message_id;
  const chat = message.chat;
  const messageUrl = chat.username
    ? `https://t.me/${chat.username}/${messageId}`
    : `https://t.me/c/${String(chat.id).replace(/^-100/, "")}/${messageId}`;

  return { messageId, messageUrl };
}

export async function sendTelegramMessage(
  text: string,
  channelId: string,
): Promise<{ messageId: number; messageUrl: string }> {
  const message = await getTelegramApi().sendMessage(channelId, text, {
    parse_mode: "HTML",
  });
  return parseTelegramSendResult(message);
}

async function getTelegramBotId(): Promise<number> {
  if (cachedBotId !== null) {
    return cachedBotId;
  }
  cachedBotId = (await getTelegramApi().getMe()).id;
  return cachedBotId;
}

/**
 * Parses a Telegram message URL (as stored in `telegramPostId`) into the `chat_id` /
 * `message_id` pair the Bot API needs. Returns null for URLs in an unexpected shape.
 */
export function parseTelegramMessageUrl(
  url: string,
): { chatId: string; messageId: number } | null {
  // Public channels: https://t.me/<username>/<messageId>
  // Private channels: https://t.me/c/<internalId>/<messageId>
  const match = url.match(/^https:\/\/t\.me\/(c\/)?([^/]+)\/(\d+)$/);
  if (!match) {
    return null;
  }

  const isPrivate = Boolean(match[1]);
  const identifier = match[2];
  const messageId = Number(match[3]);
  if (!identifier || !Number.isFinite(messageId)) {
    return null;
  }

  return {
    chatId: isPrivate ? `-100${identifier}` : `@${identifier}`,
    messageId,
  };
}

/** Checks whether the bot has the `can_delete_messages` admin right in a chat. */
export async function canBotDeleteMessages(chatId: string): Promise<boolean> {
  const botId = await getTelegramBotId();
  const member = await getTelegramApi().getChatMember(chatId, botId);

  // The channel creator can always delete; admins need the explicit right.
  return (
    member.status === "creator" ||
    (member.status === "administrator" && member.can_delete_messages === true)
  );
}

/** Deletes a message from a Telegram channel. */
export async function deleteTelegramMessage(
  chatId: string,
  messageId: number,
): Promise<void> {
  await getTelegramApi().deleteMessage(chatId, messageId);
}

/** Posts a photo with an optional HTML caption to a Telegram channel. */
export async function sendTelegramPhoto(
  photo: { data: ArrayBuffer; filename: string; contentType: string },
  caption: string,
  channelId: string,
): Promise<{ messageId: number; messageUrl: string }> {
  const message = await getTelegramApi().sendPhoto(
    channelId,
    new InputFile(new Uint8Array(photo.data), photo.filename),
    {
      ...(caption ? { caption, parse_mode: "HTML" as const } : {}),
    },
  );
  return parseTelegramSendResult(message);
}

export async function getTelegramBotProfile() {
  return getTelegramApi().getMe();
}

export async function getTelegramWebhookInfo() {
  return getTelegramApi().getWebhookInfo();
}

export async function getTelegramChat(chatId: string) {
  return getTelegramApi().getChat(chatId);
}

export async function getTelegramChatMember(chatId: string, userId: number) {
  return getTelegramApi().getChatMember(chatId, userId);
}

export async function setTelegramResumeWebhook(input: {
  url: string;
  secretToken: string;
}): Promise<void> {
  await getTelegramApi().setWebhook(input.url, {
    secret_token: input.secretToken,
    allowed_updates: ["message", "channel_post"],
    drop_pending_updates: false,
    // Idempotency is already enforced in the database; keeping delivery
    // serial also avoids needlessly competing AI queue inserts.
    max_connections: 1,
  });
}

export async function downloadTelegramFile(
  fileId: string,
  maximumBytes: number,
): Promise<Buffer> {
  const file = await getTelegramApi().getFile(fileId);

  if (!file.file_path) {
    throw new Error("Telegram getFile did not return file_path");
  }
  if (file.file_size !== undefined && file.file_size > maximumBytes) {
    throw new Error(`Telegram file exceeds the ${maximumBytes}-byte limit`);
  }
  const token = requireTelegramToken();

  const response = await fetch(
    `${TELEGRAM_API_ORIGIN}/file/bot${token}/${file.file_path}`,
  );
  if (!response.ok) {
    throw new Error(
      `Telegram file download failed (${response.status}): ${response.statusText}`,
    );
  }

  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maximumBytes) {
    throw new Error(`Telegram file exceeds the ${maximumBytes}-byte limit`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > maximumBytes) {
    throw new Error(`Telegram file exceeds the ${maximumBytes}-byte limit`);
  }

  return buffer;
}
