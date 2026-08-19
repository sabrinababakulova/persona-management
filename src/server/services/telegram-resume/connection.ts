import { eq, sql } from "drizzle-orm";

import { ensureCompanyTelegramResumeWarehouse } from "~/server/company/telegram-resume-warehouse";
import { companyTelegramResumeConfigs } from "~/server/db/schema";
import { verifyTelegramResumeGroup } from "~/server/services/telegram";

type DatabaseClient = typeof import("~/server/db").db;

export class TelegramResumeGroupInUseError extends Error {
  constructor() {
    super("Telegram group is already connected to another company");
    this.name = "TelegramResumeGroupInUseError";
  }
}

/**
 * Converts a public group handle/link or a numeric Telegram chat id into the
 * reference accepted by Bot API getChat. Private invite links cannot be
 * resolved by the Bot API, so private groups must use their numeric chat id.
 */
export function normalizeTelegramResumeGroupReference(rawValue: string) {
  const value = rawValue.trim();
  if (/^-\d{5,20}$/.test(value)) {
    return value;
  }

  const linkMatch = value.match(
    /^(?:https?:\/\/)?(?:www\.)?(?:t\.me|telegram\.me)\/([A-Za-z][A-Za-z0-9_]{4,31})\/?$/i,
  );
  const username = linkMatch?.[1] ?? value.replace(/^@/, "");
  if (!/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(username)) {
    return null;
  }

  return `@${username}`;
}

/**
 * Verifies the shared bot's access, then atomically binds the canonical chat
 * id to exactly one company. No command needs to be sent in Telegram: once the
 * row exists, every new document from that chat is routed by the webhook.
 */
export async function connectTelegramResumeGroup(input: {
  db: DatabaseClient;
  companyId: string;
  groupReference: string;
}) {
  const normalized = normalizeTelegramResumeGroupReference(
    input.groupReference,
  );
  if (!normalized) {
    return null;
  }

  const group = await verifyTelegramResumeGroup(normalized);

  await input.db.transaction(async (transaction) => {
    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`telegram-resume-group:${group.chatId}`}, 0))`,
    );

    const [owner] = await transaction
      .select({ companyId: companyTelegramResumeConfigs.companyId })
      .from(companyTelegramResumeConfigs)
      .where(eq(companyTelegramResumeConfigs.chatId, group.chatId))
      .limit(1);
    if (owner && owner.companyId !== input.companyId) {
      throw new TelegramResumeGroupInUseError();
    }

    const warehouse = await ensureCompanyTelegramResumeWarehouse(
      transaction,
      input.companyId,
    );

    await transaction
      .insert(companyTelegramResumeConfigs)
      .values({
        companyId: input.companyId,
        chatId: group.chatId,
        warehouseVacancyId: warehouse.id,
      })
      .onConflictDoUpdate({
        target: companyTelegramResumeConfigs.companyId,
        set: {
          chatId: group.chatId,
          warehouseVacancyId: warehouse.id,
          updatedAt: new Date(),
        },
      });
  });

  return group;
}
