import { env } from "~/env";

export function isTelegramConfigured(): boolean {
  return !!env.TELEGRAM_BOT_TOKEN;
}

export async function sendTelegramMessage(
  text: string,
  channelId: string,
): Promise<void> {
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
}
