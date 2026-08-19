import { autoRetry } from "@grammyjs/auto-retry";
import { Api, InputFile } from "grammy";
import type { Message } from "grammy/types";

import { env } from "~/env";

const TELEGRAM_API_ORIGIN = "https://api.telegram.org";

/** Label of the button an admin presses after publishing the post themselves. */
export const TELEGRAM_POSTED_BUTTON_TEXT = "✅ Запощено";
/** Shown in place of the button once the confirmation is recorded. */
export const TELEGRAM_POSTED_DONE_TEXT = "✅ Публикация подтверждена";
/**
 * Prefix of `callback_data` for those confirmations, followed by the dispatch
 * id. Telegram caps `callback_data` at 64 bytes, which a prefix plus a UUID
 * fits inside.
 */
export const TELEGRAM_POSTED_CALLBACK_PREFIX = "posted:";
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

/**
 * Normalizes a Telegram @username into the form stored in the database.
 *
 * Accepts what a recruiter is likely to paste — `@name`, `name`, or a
 * `t.me/name` link — and returns a bare lowercase handle. Telegram usernames
 * are case-insensitive, so lowercasing is what makes the `/start` lookup exact.
 * Returns null when the value cannot be a username.
 */
export function normalizeTelegramUsername(value: string): string | null {
  const handle = value
    .trim()
    .replace(/^https?:\/\/(t|telegram)\.me\//i, "")
    .replace(/^@/, "")
    .trim();

  // Telegram's own rule: 5-32 chars, letters/digits/underscore.
  return /^[A-Za-z0-9_]{5,32}$/.test(handle) ? handle.toLowerCase() : null;
}

/** Channel metadata plus what the bot is actually allowed to do there. */
export type TelegramChannelInfo = {
  title: string | null;
  username: string | null;
  memberCount: number | null;
  /** True when the bot can post on its own (i.e. `direct` delivery is possible). */
  canPost: boolean;
  isBotMember: boolean;
};

/**
 * Resolves a channel for the add-channel form.
 *
 * `getChat` works for any public channel without the bot being a member, so the
 * recruiter sees the real title and subscriber count before saving. The
 * membership probe is separate and allowed to fail: a bot that is not in the
 * channel simply cannot post, which is not an error at this stage.
 */
export async function resolveTelegramChannelInfo(
  channelId: string,
): Promise<TelegramChannelInfo> {
  const api = getTelegramApi();
  const chat = await api.getChat(channelId);

  const memberCount = await api.getChatMemberCount(channelId).catch(() => null);

  let canPost = false;
  let isBotMember = false;
  try {
    const botId = await getTelegramBotId();
    const member = await api.getChatMember(channelId, botId);
    isBotMember =
      member.status === "administrator" || member.status === "creator";
    canPost =
      member.status === "creator" ||
      (member.status === "administrator" && member.can_post_messages === true);
  } catch {
    // Bot is not in the channel — leave both flags false.
  }

  return {
    title: "title" in chat ? (chat.title ?? null) : null,
    username: "username" in chat ? (chat.username ?? null) : null,
    memberCount,
    canPost,
    isBotMember,
  };
}

/**
 * Sends a ready-made vacancy post to a channel admin's DM.
 *
 * The inline button is how the admin tells us they published it — we cannot see
 * their channel, so this callback is the only completion signal.
 */
export async function sendVacancyToChannelAdmin(input: {
  chatId: string;
  text: string;
  buttonText: string;
  callbackData: string;
  photo?: { data: ArrayBuffer; filename: string; contentType: string };
}): Promise<{ messageId: number }> {
  const replyMarkup = {
    inline_keyboard: [
      [{ text: input.buttonText, callback_data: input.callbackData }],
    ],
  };

  const message = input.photo
    ? await getTelegramApi().sendPhoto(
        input.chatId,
        new InputFile(new Uint8Array(input.photo.data), input.photo.filename),
        {
          caption: input.text,
          parse_mode: "HTML",
          reply_markup: replyMarkup,
        },
      )
    : await getTelegramApi().sendMessage(input.chatId, input.text, {
        parse_mode: "HTML",
        reply_markup: replyMarkup,
      });

  return { messageId: message.message_id };
}

/**
 * Replaces the button on an already-sent DM with a static confirmation line.
 *
 * Failures are swallowed: the confirmation is already recorded in the database,
 * and a stale button in Telegram must not fail the request that recorded it.
 */
export async function markAdminMessageConfirmed(input: {
  chatId: string;
  messageId: number;
  label: string;
}): Promise<void> {
  await getTelegramApi()
    .editMessageReplyMarkup(input.chatId, input.messageId, {
      reply_markup: {
        inline_keyboard: [[{ text: input.label, callback_data: "noop" }]],
      },
    })
    .catch(() => undefined);
}

/** Acknowledges a button press so Telegram stops showing the spinner. */
export async function answerTelegramCallback(
  callbackQueryId: string,
  text?: string,
): Promise<void> {
  await getTelegramApi()
    .answerCallbackQuery(callbackQueryId, text ? { text } : undefined)
    .catch(() => undefined);
}

export async function sendTelegramPlainMessage(
  chatId: string,
  text: string,
): Promise<void> {
  await getTelegramApi().sendMessage(chatId, text, { parse_mode: "HTML" });
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

export type TelegramResumeGroupVerificationErrorCode =
  | "not_found"
  | "not_group"
  | "bot_not_member"
  | "bot_cannot_read"
  | "protected_content";

export class TelegramResumeGroupVerificationError extends Error {
  constructor(
    public readonly code: TelegramResumeGroupVerificationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "TelegramResumeGroupVerificationError";
  }
}

export type VerifiedTelegramResumeGroup = {
  chatId: string;
  title: string;
  type: "group" | "supergroup";
  botStatus: "administrator" | "creator" | "member";
};

/**
 * Confirms that a chat is a resume-capable group and that the shared bot can
 * receive ordinary document messages there. This prevents saving a group that
 * looks reachable but would silently hide every resume from the bot.
 */
export async function verifyTelegramResumeGroup(
  chatReference: string,
): Promise<VerifiedTelegramResumeGroup> {
  const api = getTelegramApi();

  let chat: Awaited<ReturnType<typeof api.getChat>>;
  try {
    chat = await api.getChat(chatReference);
  } catch {
    throw new TelegramResumeGroupVerificationError(
      "not_found",
      "Telegram group was not found",
    );
  }

  if (chat.type !== "group" && chat.type !== "supergroup") {
    throw new TelegramResumeGroupVerificationError(
      "not_group",
      "Only Telegram groups and supergroups can receive resumes",
    );
  }
  if (chat.has_protected_content) {
    throw new TelegramResumeGroupVerificationError(
      "protected_content",
      "The Telegram group has protected content enabled",
    );
  }

  const bot = await api.getMe();
  let membership: Awaited<ReturnType<typeof api.getChatMember>>;
  try {
    membership = await api.getChatMember(chat.id, bot.id);
  } catch {
    throw new TelegramResumeGroupVerificationError(
      "bot_not_member",
      "The Telegram bot is not a member of the group",
    );
  }

  if (
    membership.status !== "administrator" &&
    membership.status !== "creator" &&
    membership.status !== "member"
  ) {
    throw new TelegramResumeGroupVerificationError(
      "bot_not_member",
      "The Telegram bot is not an active member of the group",
    );
  }

  const receivesAllMessages =
    membership.status === "administrator" ||
    membership.status === "creator" ||
    bot.can_read_all_group_messages === true;
  if (!receivesAllMessages) {
    throw new TelegramResumeGroupVerificationError(
      "bot_cannot_read",
      "The Telegram bot cannot read ordinary group documents",
    );
  }

  return {
    chatId: String(chat.id),
    title: chat.title,
    type: chat.type,
    botStatus: membership.status,
  };
}

export async function setTelegramResumeWebhook(input: {
  url: string;
  secretToken: string;
}): Promise<void> {
  await getTelegramApi().setWebhook(input.url, {
    secret_token: input.secretToken,
    // `callback_query` carries the admins' "Запощено" confirmations; without it
    // Telegram silently drops those updates and publications never go active.
    allowed_updates: ["message", "channel_post", "callback_query"],
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
