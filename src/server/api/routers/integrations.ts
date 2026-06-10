import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { env } from "~/env";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {
  userHhAccounts,
  userTelegramBotSettings,
  userTelegramChannels,
} from "~/server/db/schema";
import { validateTelegramBotToken } from "~/server/services/telegram";
import { decryptSecret, encryptSecret } from "~/server/utils/secret-encryption";

function maskSecret(value: string): string {
  return `${"•".repeat(8)}${value.slice(-4)}`;
}

function normalizeTelegramChannelId(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Укажите Telegram-канал",
    });
  }

  if (trimmed.startsWith("@")) {
    return trimmed;
  }
  if (/^-100\d{5,}$/.test(trimmed)) {
    return trimmed;
  }
  if (/^[A-Za-z0-9_]{5,32}$/.test(trimmed)) {
    return `@${trimmed}`;
  }

  const link = trimmed.match(/^https?:\/\//)
    ? trimmed
    : trimmed.startsWith("t.me/") || trimmed.startsWith("telegram.me/")
      ? `https://${trimmed}`
      : null;
  if (!link) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Укажите @username, -100... ID или ссылку вида https://t.me/channel",
    });
  }

  let url: URL;
  try {
    url = new URL(link);
  } catch {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Некорректная ссылка Telegram",
    });
  }

  if (!["t.me", "telegram.me"].includes(url.hostname)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Поддерживаются только ссылки t.me или telegram.me",
    });
  }

  const segments = url.pathname.split("/").filter(Boolean);
  const first = segments[0];
  if (!first) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "В ссылке Telegram не найден канал",
    });
  }

  if (first === "c" && segments[1] && /^\d+$/.test(segments[1])) {
    return `-100${segments[1]}`;
  }

  const publicChannel = first === "s" ? segments[1] : first;
  if (publicChannel?.startsWith("+") || publicChannel === "joinchat") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Ссылка-приглашение не содержит ID канала. Добавьте публичную ссылку, @username или -100... ID.",
    });
  }

  if (publicChannel && /^[A-Za-z0-9_]{5,32}$/.test(publicChannel)) {
    return `@${publicChannel}`;
  }

  throw new TRPCError({
    code: "BAD_REQUEST",
    message: "Не удалось определить ID канала из ссылки Telegram",
  });
}

export const integrationsRouter = createTRPCRouter({
  // ── Telegram bot ──────────────────────────────────────────────────

  getTelegramBotSettings: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select()
      .from(userTelegramBotSettings)
      .where(eq(userTelegramBotSettings.userId, ctx.session.user.id))
      .limit(1);

    const settings = rows[0];
    if (settings) {
      const botToken = decryptSecret(settings.botToken);
      return {
        id: settings.id,
        botUsername: settings.botUsername,
        maskedToken: maskSecret(botToken),
        source: "user" as const,
        createdAt: settings.createdAt,
        updatedAt: settings.updatedAt,
      };
    }

    if (env.TELEGRAM_BOT_TOKEN) {
      return {
        id: null,
        botUsername: null,
        maskedToken: maskSecret(env.TELEGRAM_BOT_TOKEN),
        source: "env" as const,
        createdAt: null,
        updatedAt: null,
      };
    }

    return null;
  }),

  saveTelegramBotToken: protectedProcedure
    .input(
      z.object({
        botToken: z.string().trim().min(20).max(255),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      let bot: { username: string | null };
      try {
        bot = await validateTelegramBotToken(input.botToken);
      } catch {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Не удалось проверить токен. Убедитесь, что вы скопировали токен из BotFather полностью.",
        });
      }

      const existing = await ctx.db
        .select({ id: userTelegramBotSettings.id })
        .from(userTelegramBotSettings)
        .where(eq(userTelegramBotSettings.userId, ctx.session.user.id))
        .limit(1);

      if (existing[0]) {
        await ctx.db
          .update(userTelegramBotSettings)
          .set({
            botToken: encryptSecret(input.botToken),
            botUsername: bot.username,
          })
          .where(eq(userTelegramBotSettings.id, existing[0].id));
      } else {
        await ctx.db.insert(userTelegramBotSettings).values({
          userId: ctx.session.user.id,
          botToken: encryptSecret(input.botToken),
          botUsername: bot.username,
        });
      }

      return { success: true, botUsername: bot.username };
    }),

  removeTelegramBotToken: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.db
      .delete(userTelegramBotSettings)
      .where(eq(userTelegramBotSettings.userId, ctx.session.user.id));

    return { success: true };
  }),

  // ── Telegram channels ──────────────────────────────────────────────

  getTelegramChannels: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(userTelegramChannels)
      .where(eq(userTelegramChannels.userId, ctx.session.user.id));
  }),

  addTelegramChannel: protectedProcedure
    .input(
      z.object({
        channelId: z.string().min(1).max(255),
        label: z.string().max(255).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const channelId = normalizeTelegramChannelId(input.channelId);
      const rows = await ctx.db
        .insert(userTelegramChannels)
        .values({
          userId: ctx.session.user.id,
          channelId,
          label: input.label ?? null,
        })
        .returning();

      return rows[0] ?? null;
    }),

  removeTelegramChannel: protectedProcedure
    .input(z.object({ id: z.string().min(1).max(255) }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await ctx.db
        .delete(userTelegramChannels)
        .where(
          and(
            eq(userTelegramChannels.id, input.id),
            eq(userTelegramChannels.userId, ctx.session.user.id),
          ),
        )
        .returning();

      if (deleted.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Канал не найден",
        });
      }

      return { success: true };
    }),

  // ── hh.uz account ─────────────────────────────────────────────────

  getHhAccount: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select()
      .from(userHhAccounts)
      .where(eq(userHhAccounts.userId, ctx.session.user.id))
      .limit(1);

    const account = rows[0];
    if (!account) return null;

    // Mask secrets for display
    return {
      id: account.id,
      userId: account.userId,
      clientId: account.clientId,
      clientSecret: account.clientSecret
        ? `${"•".repeat(8)}${account.clientSecret.slice(-4)}`
        : null,
      employerId: account.employerId,
      email: account.email,
      hasTokens: !!(account.accessToken && account.refreshToken),
      isConfigured: Boolean(env.HH_CLIENT_ID) && Boolean(env.HH_CLIENT_SECRET),
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    };
  }),

  saveHhAccount: protectedProcedure
    .input(
      z.object({
        clientId: z.string().min(1).max(255),
        clientSecret: z.string().min(1).max(500),
        employerId: z.string().min(1).max(255),
        email: z.string().max(255).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Upsert — one hh account per user
      const existing = await ctx.db
        .select({ id: userHhAccounts.id })
        .from(userHhAccounts)
        .where(eq(userHhAccounts.userId, ctx.session.user.id))
        .limit(1);

      if (existing[0]) {
        await ctx.db
          .update(userHhAccounts)
          .set({
            clientId: input.clientId,
            clientSecret: input.clientSecret,
            employerId: input.employerId,
            email: input.email ?? null,
          })
          .where(eq(userHhAccounts.id, existing[0].id));
      } else {
        await ctx.db.insert(userHhAccounts).values({
          userId: ctx.session.user.id,
          clientId: input.clientId,
          clientSecret: input.clientSecret,
          employerId: input.employerId,
          email: input.email ?? null,
        });
      }

      return { success: true };
    }),

  removeHhAccount: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.db
      .delete(userHhAccounts)
      .where(eq(userHhAccounts.userId, ctx.session.user.id));

    return { success: true };
  }),
});
