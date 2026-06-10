import { env } from "~/env";

function getTelegramBotToken(botToken?: string | null): string {
  const token = botToken?.trim() || env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("Telegram bot token is not configured");
  }
  return token;
}

export function isTelegramConfigured(botToken?: string | null): boolean {
  return !!(botToken?.trim() || env.TELEGRAM_BOT_TOKEN);
}

type TelegramSendResponse = {
  ok: boolean;
  result: {
    message_id: number;
    chat: { id: number; username?: string };
  };
};

function parseTelegramSendResult(data: TelegramSendResponse): {
  messageId: number;
  messageUrl: string;
} {
  const messageId = data.result.message_id;
  const chat = data.result.chat;
  const messageUrl = chat.username
    ? `https://t.me/${chat.username}/${messageId}`
    : `https://t.me/c/${String(chat.id).replace(/^-100/, "")}/${messageId}`;

  return { messageId, messageUrl };
}

export async function sendTelegramMessage(
  text: string,
  channelId: string,
  botToken?: string | null,
): Promise<{ messageId: number; messageUrl: string }> {
  const token = getTelegramBotToken(botToken);
  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: channelId,
      text,
      parse_mode: "HTML",
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Telegram API error ${response.status}: ${body}`);
  }

  const data = (await response.json()) as TelegramSendResponse;
  return parseTelegramSendResult(data);
}

const cachedBotIds = new Map<string, number>();

async function getTelegramBotId(botToken?: string | null): Promise<number> {
  const token = getTelegramBotToken(botToken);
  const cachedBotId = cachedBotIds.get(token);
  if (cachedBotId !== undefined) {
    return cachedBotId;
  }

  const url = `https://api.telegram.org/bot${token}/getMe`;
  const response = await fetch(url);

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Telegram API error ${response.status}: ${body}`);
  }

  const data = (await response.json()) as { result: { id: number } };
  cachedBotIds.set(token, data.result.id);
  return data.result.id;
}

export async function validateTelegramBotToken(botToken: string): Promise<{
  botId: number;
  username: string | null;
}> {
  const token = getTelegramBotToken(botToken);
  const url = `https://api.telegram.org/bot${token}/getMe`;
  const response = await fetch(url);

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Telegram API error ${response.status}: ${body}`);
  }

  const data = (await response.json()) as {
    ok: boolean;
    result: { id: number; username?: string };
  };
  if (!data.ok) {
    throw new Error("Telegram bot token is invalid");
  }

  cachedBotIds.set(token, data.result.id);
  return {
    botId: data.result.id,
    username: data.result.username ?? null,
  };
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
export async function canBotDeleteMessages(
  chatId: string,
  botToken?: string | null,
): Promise<boolean> {
  const token = getTelegramBotToken(botToken);
  const botId = await getTelegramBotId(token);
  const url = `https://api.telegram.org/bot${token}/getChatMember`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, user_id: botId }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Telegram API error ${response.status}: ${body}`);
  }

  const data = (await response.json()) as {
    result: { status: string; can_delete_messages?: boolean };
  };

  // The channel creator can always delete; admins need the explicit right.
  return (
    data.result.status === "creator" || data.result.can_delete_messages === true
  );
}

/** Deletes a message from a Telegram channel. */
export async function deleteTelegramMessage(
  chatId: string,
  messageId: number,
  botToken?: string | null,
): Promise<void> {
  const token = getTelegramBotToken(botToken);
  const url = `https://api.telegram.org/bot${token}/deleteMessage`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Telegram API error ${response.status}: ${body}`);
  }
}

/** Posts a photo with an optional HTML caption to a Telegram channel. */
export async function sendTelegramPhoto(
  photo: { data: ArrayBuffer; filename: string; contentType: string },
  caption: string,
  channelId: string,
  botToken?: string | null,
): Promise<{ messageId: number; messageUrl: string }> {
  const token = getTelegramBotToken(botToken);
  const url = `https://api.telegram.org/bot${token}/sendPhoto`;

  const form = new FormData();
  form.append("chat_id", channelId);
  if (caption) {
    form.append("caption", caption);
    form.append("parse_mode", "HTML");
  }
  form.append(
    "photo",
    new Blob([photo.data], { type: photo.contentType }),
    photo.filename,
  );

  const response = await fetch(url, { method: "POST", body: form });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Telegram API error ${response.status}: ${body}`);
  }

  const data = (await response.json()) as TelegramSendResponse;
  return parseTelegramSendResult(data);
}
