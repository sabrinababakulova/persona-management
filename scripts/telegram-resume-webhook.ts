import { and, eq } from "drizzle-orm";

import { env } from "../src/env";
import { db } from "../src/server/db";
import { companies, vacancies } from "../src/server/db/schema";
import {
  getTelegramBotProfile,
  getTelegramChat,
  getTelegramChatMember,
  getTelegramWebhookInfo,
  setTelegramResumeWebhook,
} from "../src/server/services/telegram";
import { requireTelegramResumeConfig } from "../src/server/services/telegram-resume/config";

async function verifyConfiguration() {
  const config = requireTelegramResumeConfig();
  const [company] = await db
    .select({ id: companies.id, name: companies.name })
    .from(companies)
    .where(eq(companies.id, config.companyId))
    .limit(1);
  if (!company) {
    throw new Error(
      `TELEGRAM_RESUME_COMPANY_ID does not match an existing company`,
    );
  }
  const [vacancy] = await db
    .select({ id: vacancies.id, title: vacancies.title })
    .from(vacancies)
    .where(
      and(
        eq(vacancies.id, config.vacancyId),
        eq(vacancies.companyId, config.companyId),
        eq(vacancies.isPublication, false),
        eq(vacancies.isInternal, true),
      ),
    )
    .limit(1);
  if (!vacancy) {
    throw new Error(
      "TELEGRAM_RESUME_VACANCY_ID must be an internal base vacancy owned by TELEGRAM_RESUME_COMPANY_ID",
    );
  }

  const bot = await getTelegramBotProfile();
  const chat = await getTelegramChat(config.chatId);
  const membership = await getTelegramChatMember(config.chatId, bot.id);
  const receivesAllMessages =
    membership.status === "administrator" ||
    membership.status === "creator" ||
    bot.can_read_all_group_messages === true;

  if (!receivesAllMessages) {
    throw new Error(
      "The bot cannot see ordinary group documents. Make it an administrator " +
        "or disable Group Privacy in BotFather and re-add it to the group.",
    );
  }
  if (chat.has_protected_content) {
    throw new Error(
      "The group has protected content enabled, so resumes must not be downloaded",
    );
  }

  return { config, company, vacancy, bot, chat, membership };
}

async function main() {
  const command = process.argv[2] ?? "status";
  if (command !== "status" && command !== "set") {
    throw new Error("Usage: telegram-resume-webhook.ts [status|set]");
  }

  const verified = await verifyConfiguration();
  if (command === "set") {
    const publicOrigin =
      env.TELEGRAM_WEBHOOK_BASE_URL ??
      env.AUTH_URL ??
      (env.VERCEL_URL ? `https://${env.VERCEL_URL}` : undefined);
    if (!publicOrigin) {
      throw new Error(
        "TELEGRAM_WEBHOOK_BASE_URL, AUTH_URL, or VERCEL_URL is required to set the webhook",
      );
    }

    const webhookUrl = new URL(
      "/api/integrations/telegram/resume-webhook",
      publicOrigin,
    );
    if (webhookUrl.protocol !== "https:") {
      throw new Error("Telegram resume webhook URL must use HTTPS");
    }

    const preflight = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": verified.config.webhookSecret,
      },
      body: JSON.stringify({ update_id: 0 }),
    });
    if (!preflight.ok) {
      throw new Error(
        `Webhook preflight failed (${preflight.status}); deploy and configure ` +
          "the application before setting the Telegram webhook",
      );
    }

    await setTelegramResumeWebhook({
      url: webhookUrl.toString(),
      secretToken: verified.config.webhookSecret,
    });
  }

  const currentWebhook = await getTelegramWebhookInfo();
  console.log(
    JSON.stringify(
      {
        bot: {
          id: verified.bot.id,
          username: verified.bot.username,
          readsAllGroupMessages:
            verified.bot.can_read_all_group_messages ?? false,
        },
        chat: {
          id: verified.chat.id,
          type: verified.chat.type,
          title: verified.chat.title,
          membership: verified.membership.status,
        },
        company: verified.company,
        vacancy: verified.vacancy,
        webhook: {
          configured: Boolean(currentWebhook.url),
          url: currentWebhook.url || null,
          pendingUpdates: currentWebhook.pending_update_count,
          lastError: currentWebhook.last_error_message ?? null,
          setByThisCommand: command === "set",
        },
      },
      null,
      2,
    ),
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
