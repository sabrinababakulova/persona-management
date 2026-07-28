import { createHmac } from "node:crypto";

import { env } from "~/env";

export type TelegramResumeConfig = {
  chatId: string;
  companyId: string;
  vacancyId: string;
  webhookSecret: string;
};

export function getTelegramResumeConfig(): TelegramResumeConfig | null {
  if (
    !env.TELEGRAM_BOT_TOKEN ||
    !env.TELEGRAM_RESUME_CHAT_ID ||
    !env.TELEGRAM_RESUME_COMPANY_ID ||
    !env.TELEGRAM_RESUME_VACANCY_ID
  ) {
    return null;
  }

  return {
    chatId: env.TELEGRAM_RESUME_CHAT_ID,
    companyId: env.TELEGRAM_RESUME_COMPANY_ID,
    vacancyId: env.TELEGRAM_RESUME_VACANCY_ID,
    webhookSecret:
      env.TELEGRAM_WEBHOOK_SECRET ??
      createHmac("sha256", env.AUTH_SECRET)
        .update("telegram-resume-webhook")
        .digest("hex"),
  };
}

export function requireTelegramResumeConfig(): TelegramResumeConfig {
  const config = getTelegramResumeConfig();
  if (!config) {
    throw new Error(
      "Telegram resume ingestion requires TELEGRAM_BOT_TOKEN, " +
        "TELEGRAM_RESUME_CHAT_ID, TELEGRAM_RESUME_COMPANY_ID, and " +
        "TELEGRAM_RESUME_VACANCY_ID",
    );
  }

  return config;
}
