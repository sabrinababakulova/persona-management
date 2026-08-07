import { createHmac } from "node:crypto";

import { eq } from "drizzle-orm";

import { env } from "~/env";
import { companyTelegramResumeConfigs, vacancies } from "~/server/db/schema";

type DatabaseClient = typeof import("~/server/db").db;

export type TelegramResumeConfig = {
  chatId: string;
  companyId: string;
  vacancyId: string;
  webhookSecret: string;
};

/**
 * Secret Telegram echoes back in `x-telegram-bot-api-secret-token`. Shared by
 * every company config — there is only one bot webhook.
 */
export function getTelegramResumeWebhookSecret(): string {
  return (
    env.TELEGRAM_WEBHOOK_SECRET ??
    createHmac("sha256", env.AUTH_SECRET)
      .update("telegram-resume-webhook")
      .digest("hex")
  );
}

/**
 * Legacy single-company config from TELEGRAM_RESUME_* env vars. Runtime code
 * prefers the `company_telegram_resume_config` table (via the ForChat /
 * ForCompany resolvers below); this remains as a fallback so existing
 * deployments keep working before their row is created in Directus, and as
 * the source for the ops scripts.
 */
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
    webhookSecret: getTelegramResumeWebhookSecret(),
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

function toRuntimeConfig(row: {
  companyId: string;
  chatId: string;
  warehouseVacancyId: string;
}): TelegramResumeConfig {
  return {
    chatId: row.chatId,
    companyId: row.companyId,
    vacancyId: row.warehouseVacancyId,
    webhookSecret: getTelegramResumeWebhookSecret(),
  };
}

/**
 * Guards against a Directus misconfiguration pointing a company's config at
 * another company's vacancy — that would leak candidates across tenants.
 */
async function validateWarehouseOwnership(
  database: DatabaseClient,
  config: TelegramResumeConfig,
): Promise<TelegramResumeConfig | null> {
  const [vacancy] = await database
    .select({ companyId: vacancies.companyId })
    .from(vacancies)
    .where(eq(vacancies.id, config.vacancyId))
    .limit(1);

  if (!vacancy || vacancy.companyId !== config.companyId) {
    console.error(
      "Telegram resume config rejected: warehouse vacancy is missing or " +
        "belongs to a different company",
      { companyId: config.companyId, vacancyId: config.vacancyId },
    );
    return null;
  }

  return config;
}

/**
 * Resolves the ingestion config for an incoming Telegram update by its chat
 * id. Table rows win; the env config applies only when its chat id matches.
 */
export async function getTelegramResumeConfigForChat(
  database: DatabaseClient,
  chatId: string,
): Promise<TelegramResumeConfig | null> {
  if (!env.TELEGRAM_BOT_TOKEN) {
    return null;
  }

  const [row] = await database
    .select({
      companyId: companyTelegramResumeConfigs.companyId,
      chatId: companyTelegramResumeConfigs.chatId,
      warehouseVacancyId: companyTelegramResumeConfigs.warehouseVacancyId,
    })
    .from(companyTelegramResumeConfigs)
    .where(eq(companyTelegramResumeConfigs.chatId, chatId))
    .limit(1);

  if (row) {
    return validateWarehouseOwnership(database, toRuntimeConfig(row));
  }

  const legacy = getTelegramResumeConfig();
  return legacy?.chatId === chatId ? legacy : null;
}

/**
 * Resolves a company's ingestion config (and thus its warehouse vacancy).
 * Table rows win; the env config applies only when its company id matches.
 */
export async function getTelegramResumeConfigForCompany(
  database: DatabaseClient,
  companyId: string,
): Promise<TelegramResumeConfig | null> {
  const [row] = await database
    .select({
      companyId: companyTelegramResumeConfigs.companyId,
      chatId: companyTelegramResumeConfigs.chatId,
      warehouseVacancyId: companyTelegramResumeConfigs.warehouseVacancyId,
    })
    .from(companyTelegramResumeConfigs)
    .where(eq(companyTelegramResumeConfigs.companyId, companyId))
    .limit(1);

  if (row) {
    return validateWarehouseOwnership(database, toRuntimeConfig(row));
  }

  const legacy = getTelegramResumeConfig();
  return legacy?.companyId === companyId ? legacy : null;
}
