import { randomBytes } from "node:crypto";

import { and, eq, gt, like, lt, or, sql } from "drizzle-orm";

import { ensureCompanyTelegramResumeWarehouse } from "~/server/company/telegram-resume-warehouse";
import {
  companyTelegramResumeConfigs,
  verificationTokens,
} from "~/server/db/schema";
import {
  getTelegramBotProfile,
  TelegramResumeGroupVerificationError,
  verifyTelegramResumeGroup,
} from "~/server/services/telegram";

type DatabaseClient = typeof import("~/server/db").db;

const CONNECT_TOKEN_PREFIX = "telegram-resume-connect:";
const CONNECT_TOKEN_TTL_MS = 15 * 60 * 1000;

export type TelegramResumeConnectOutcome =
  | "connected"
  | "invalid_code"
  | "group_in_use"
  | "not_group"
  | "bot_not_member"
  | "bot_cannot_read"
  | "protected_content"
  | "not_found";

export function parseTelegramResumeConnectCommand(text: string | undefined) {
  const match = text
    ?.trim()
    .match(/^\/connect(?:@[A-Za-z0-9_]{5,32})?\s+([a-f0-9]{24})$/i);
  return match?.[1]?.toLowerCase() ?? null;
}

export async function createTelegramResumeConnectCode(
  database: DatabaseClient,
  companyId: string,
) {
  const bot = await getTelegramBotProfile();
  const code = randomBytes(12).toString("hex");
  const expiresAt = new Date(Date.now() + CONNECT_TOKEN_TTL_MS);

  await database.transaction(async (transaction) => {
    await transaction
      .delete(verificationTokens)
      .where(
        or(
          and(
            like(verificationTokens.identifier, `${CONNECT_TOKEN_PREFIX}%`),
            lt(verificationTokens.expires, new Date()),
          ),
          and(
            like(verificationTokens.identifier, `${CONNECT_TOKEN_PREFIX}%`),
            eq(verificationTokens.token, companyId),
          ),
        ),
      );
    await transaction.insert(verificationTokens).values({
      identifier: `${CONNECT_TOKEN_PREFIX}${code}`,
      token: companyId,
      expires: expiresAt,
    });
  });

  return {
    code,
    command: `/connect ${code}`,
    expiresAt,
    botUsername: bot.username ? `@${bot.username}` : null,
  };
}

function verificationOutcome(error: unknown): TelegramResumeConnectOutcome {
  if (error instanceof TelegramResumeGroupVerificationError) {
    return error.code;
  }
  return "not_found";
}

export async function connectTelegramResumeGroupFromCommand(input: {
  db: DatabaseClient;
  chatId: string;
  text: string | undefined;
}): Promise<{
  outcome: TelegramResumeConnectOutcome;
  companyId?: string;
  chatId?: string;
  title?: string;
}> {
  const code = parseTelegramResumeConnectCommand(input.text);
  if (!code) {
    return { outcome: "invalid_code" };
  }

  const [pending] = await input.db
    .select({ companyId: verificationTokens.token })
    .from(verificationTokens)
    .where(
      and(
        eq(verificationTokens.identifier, `${CONNECT_TOKEN_PREFIX}${code}`),
        gt(verificationTokens.expires, new Date()),
      ),
    )
    .limit(1);
  if (!pending) {
    return { outcome: "invalid_code" };
  }

  let group: Awaited<ReturnType<typeof verifyTelegramResumeGroup>>;
  try {
    group = await verifyTelegramResumeGroup(input.chatId);
  } catch (error) {
    return { outcome: verificationOutcome(error) };
  }

  const outcome = await input.db.transaction(async (transaction) => {
    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`telegram-resume-group:${group.chatId}`}, 0))`,
    );

    const [claimed] = await transaction
      .delete(verificationTokens)
      .where(
        and(
          eq(verificationTokens.identifier, `${CONNECT_TOKEN_PREFIX}${code}`),
          eq(verificationTokens.token, pending.companyId),
          gt(verificationTokens.expires, new Date()),
        ),
      )
      .returning({ companyId: verificationTokens.token });
    if (!claimed) {
      return "invalid_code" as const;
    }

    const [owner] = await transaction
      .select({ companyId: companyTelegramResumeConfigs.companyId })
      .from(companyTelegramResumeConfigs)
      .where(eq(companyTelegramResumeConfigs.chatId, group.chatId))
      .limit(1);
    if (owner && owner.companyId !== claimed.companyId) {
      return "group_in_use" as const;
    }

    const warehouse = await ensureCompanyTelegramResumeWarehouse(
      transaction,
      claimed.companyId,
    );

    await transaction
      .insert(companyTelegramResumeConfigs)
      .values({
        companyId: claimed.companyId,
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

    return "connected" as const;
  });

  return outcome === "connected"
    ? {
        outcome,
        companyId: pending.companyId,
        chatId: group.chatId,
        title: group.title,
      }
    : { outcome };
}
