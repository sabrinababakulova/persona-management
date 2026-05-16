import { env } from "~/env";

export function isTelegramConfigured(): boolean {
  return !!env.TELEGRAM_BOT_TOKEN;
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
): Promise<{ messageId: number; messageUrl: string }> {
  if (!env.TELEGRAM_BOT_TOKEN) {
    throw new Error("Telegram bot token is not configured");
  }

  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;

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

/** Posts a photo with an optional HTML caption to a Telegram channel. */
export async function sendTelegramPhoto(
  photo: { data: ArrayBuffer; filename: string; contentType: string },
  caption: string,
  channelId: string,
): Promise<{ messageId: number; messageUrl: string }> {
  if (!env.TELEGRAM_BOT_TOKEN) {
    throw new Error("Telegram bot token is not configured");
  }

  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendPhoto`;

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
