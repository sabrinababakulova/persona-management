import { and, eq, isNull } from "drizzle-orm";

import type { db as database } from "~/server/db";
import {
  telegramChannelAdmins,
  vacancies,
  vacancyTelegramDispatches,
} from "~/server/db/schema";
import {
  answerTelegramCallback,
  markAdminMessageConfirmed,
  normalizeTelegramUsername,
  sendTelegramPlainMessage,
  TELEGRAM_POSTED_CALLBACK_PREFIX,
  TELEGRAM_POSTED_DONE_TEXT,
} from "~/server/services/telegram";

type Db = typeof database;

const ACTIVATED_MESSAGE =
  "Готово! Теперь вы будете получать вакансии для публикации в вашем канале.";
const NOT_LINKED_MESSAGE =
  "Этот бот рассылает вакансии администраторам каналов. Ваш аккаунт пока не привязан ни к одному каналу — попросите рекрутера добавить ваш логин в настройках канала.";
const NO_USERNAME_MESSAGE =
  "Чтобы получать вакансии, задайте себе @username в настройках Telegram и нажмите /start ещё раз.";

/**
 * Links a Telegram account to the channel-admin records that name it.
 *
 * A bot cannot message a user who has never written to it, so `/start` is the
 * only moment we can learn an admin's numeric id. The recruiter records a
 * `@username`; this resolves it to the id that messages are actually sent to.
 * One person can admin several channels, so every matching row is updated.
 */
export async function handleTelegramStart(input: {
  db: Db;
  fromId: number;
  username?: string;
}): Promise<{ outcome: "activated" | "not_linked" | "no_username" }> {
  const chatId = String(input.fromId);

  if (!input.username) {
    await sendTelegramPlainMessage(chatId, NO_USERNAME_MESSAGE).catch(
      () => undefined,
    );
    return { outcome: "no_username" };
  }

  const username = normalizeTelegramUsername(input.username);
  if (!username) {
    await sendTelegramPlainMessage(chatId, NO_USERNAME_MESSAGE).catch(
      () => undefined,
    );
    return { outcome: "no_username" };
  }

  const linked = await input.db
    .update(telegramChannelAdmins)
    .set({ telegramUserId: chatId, activatedAt: new Date() })
    .where(eq(telegramChannelAdmins.telegramUsername, username))
    .returning({ id: telegramChannelAdmins.id });

  const message = linked.length > 0 ? ACTIVATED_MESSAGE : NOT_LINKED_MESSAGE;
  await sendTelegramPlainMessage(chatId, message).catch(() => undefined);

  return { outcome: linked.length > 0 ? "activated" : "not_linked" };
}

/** True when a callback belongs to the "Запощено" confirmation flow. */
export function isPostedCallback(data: string): boolean {
  return data.startsWith(TELEGRAM_POSTED_CALLBACK_PREFIX);
}

/**
 * Records an admin's confirmation that they published a vacancy.
 *
 * We cannot see their channel, so this button press is the only completion
 * signal — it is what flips the publication to active. The update is guarded on
 * `confirmedAt IS NULL` so a double tap (or Telegram's at-least-once delivery
 * replaying the update) cannot activate anything twice.
 */
export async function handlePostedCallback(input: {
  db: Db;
  callbackQueryId: string;
  fromId: number;
  data: string;
}): Promise<{ outcome: "confirmed" | "already_confirmed" | "not_found" }> {
  const dispatchId = input.data.slice(TELEGRAM_POSTED_CALLBACK_PREFIX.length);
  if (!dispatchId) {
    await answerTelegramCallback(input.callbackQueryId);
    return { outcome: "not_found" };
  }

  const rows = await input.db
    .select()
    .from(vacancyTelegramDispatches)
    .where(eq(vacancyTelegramDispatches.id, dispatchId))
    .limit(1);

  const dispatch = rows[0];
  // Only the admin the request was sent to may confirm it — `callback_data` is
  // visible to anyone who can see the message, so the sender is verified too.
  if (!dispatch || dispatch.adminChatId !== String(input.fromId)) {
    await answerTelegramCallback(
      input.callbackQueryId,
      "Публикация не найдена",
    );
    return { outcome: "not_found" };
  }

  if (dispatch.confirmedAt) {
    await answerTelegramCallback(input.callbackQueryId, "Уже подтверждено");
    return { outcome: "already_confirmed" };
  }

  const confirmed = await input.db
    .update(vacancyTelegramDispatches)
    .set({ confirmedAt: new Date() })
    .where(
      and(
        eq(vacancyTelegramDispatches.id, dispatchId),
        isNull(vacancyTelegramDispatches.confirmedAt),
      ),
    )
    .returning({ id: vacancyTelegramDispatches.id });

  if (confirmed.length === 0) {
    await answerTelegramCallback(input.callbackQueryId, "Уже подтверждено");
    return { outcome: "already_confirmed" };
  }

  // The publication counts as live as soon as one admin has published it.
  await input.db
    .update(vacancies)
    .set({ isActive: true })
    .where(eq(vacancies.id, dispatch.publicationId));

  await answerTelegramCallback(input.callbackQueryId, "Спасибо, отмечено!");
  await markAdminMessageConfirmed({
    chatId: dispatch.adminChatId,
    messageId: dispatch.botMessageId,
    label: TELEGRAM_POSTED_DONE_TEXT,
  });

  return { outcome: "confirmed" };
}
