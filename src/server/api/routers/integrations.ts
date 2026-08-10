import { TRPCError } from "@trpc/server";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { env } from "~/env";
import { getRequiredCompanyId } from "~/server/api/router-utils/company";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {
  clearIdentifier,
  hasActiveRecord,
  isRateLimited,
  recordAttempt,
  setMarker,
} from "~/server/auth/rate-limit";
import {
  telegramChannelAdmins,
  telegramDeliveryModes,
  userHhAccounts,
  userOlxSessions,
  userTelegramChannels,
  vacancies,
} from "~/server/db/schema";
import { getCompanyFeatures } from "~/server/services/feature-flags";
import {
  connectOlxBrowserSession,
  decryptOlxStorageState,
  encryptOlxStorageState,
  OlxBrowserFlowError,
  OlxBrowserRuntimeError,
  type OlxStorageState,
  resolveOlxBrowserExecutable,
  verifyOlxBrowserSession,
} from "~/server/services/olx-browser";
import {
  isTelegramConfigured,
  normalizeTelegramUsername,
  resolveTelegramChannelInfo,
} from "~/server/services/telegram";
import { getTelegramResumeConfigForCompany } from "~/server/services/telegram-resume/config";

const channelAdminInputSchema = z.object({
  /** Raw user input — `@name`, `name` or a t.me link; normalized server-side. */
  username: z.string().min(1).max(255),
  name: z.string().max(255).optional(),
});

const channelInputSchema = z.object({
  channelId: z.string().min(1).max(255),
  label: z.string().max(255).optional(),
  deliveryMode: z.enum(telegramDeliveryModes),
  admins: z.array(channelAdminInputSchema).max(20),
});

const OLX_LOGIN_WINDOW_MS = 15 * 60 * 1000;
const OLX_LOGIN_COOLDOWN_MS = 60 * 1000;
const OLX_ACTION_WINDOW_MS = 60 * 60 * 1000;
const OLX_ACTION_COOLDOWN_MS = 30 * 1000;

function olxConnectionError(error: unknown): TRPCError {
  if (error instanceof OlxBrowserRuntimeError) {
    if (error.code === "busy") {
      return new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message:
          "Сейчас выполняется другая операция OLX.uz. Дождитесь её завершения.",
      });
    }
    if (error.code === "unavailable") {
      return new TRPCError({
        code: "PRECONDITION_FAILED",
        message:
          "Chrome/Chromium для OLX.uz не найден на сервере. Настройте OLX_BROWSER_EXECUTABLE_PATH.",
      });
    }
    return new TRPCError({
      code: "TIMEOUT",
      message: "OLX.uz не ответил вовремя. Попробуйте позже.",
    });
  }

  if (error instanceof OlxBrowserFlowError) {
    const messages: Record<typeof error.code, string> = {
      invalid_credentials:
        "OLX.uz отклонил логин или пароль. Проверьте данные и повторите попытку.",
      challenge_required:
        "OLX.uz запросил CAPTCHA или код подтверждения. Автоматизация остановлена; завершите проверку в OLX.uz и попробуйте подключение снова.",
      reauth_required: "Сессия OLX.uz истекла. Подключите аккаунт заново.",
      form_changed:
        "Форма OLX.uz изменилась. Публикация остановлена до обновления интеграции.",
      publish_failed: "Не удалось завершить вход в OLX.uz. Попробуйте позже.",
    };
    return new TRPCError({
      code: "BAD_REQUEST",
      message: messages[error.code],
    });
  }

  console.error("Unexpected OLX browser connection error", error);
  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Не удалось подключить OLX.uz.",
  });
}

/**
 * Normalizes and de-duplicates the admin list from the modal.
 *
 * Rejects the whole payload on a malformed handle rather than silently dropping
 * it — a typo'd admin would otherwise look saved but never receive anything.
 */
function parseAdmins(admins: z.infer<typeof channelAdminInputSchema>[]) {
  const byUsername = new Map<
    string,
    { username: string; name: string | null }
  >();

  for (const admin of admins) {
    const username = normalizeTelegramUsername(admin.username);
    if (!username) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Некорректный Telegram-логин: ${admin.username}`,
      });
    }
    byUsername.set(username, { username, name: admin.name?.trim() || null });
  }

  return [...byUsername.values()];
}

/** Loads a channel, enforcing that it belongs to the caller's company. */
async function requireCompanyChannel(
  db: typeof import("~/server/db").db,
  channelRowId: string,
  companyId: string,
) {
  const rows = await db
    .select()
    .from(userTelegramChannels)
    .where(
      and(
        eq(userTelegramChannels.id, channelRowId),
        eq(userTelegramChannels.companyId, companyId),
      ),
    )
    .limit(1);

  const channel = rows[0];
  if (!channel) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Канал не найден" });
  }
  return channel;
}

export const integrationsRouter = createTRPCRouter({
  // ── OLX.uz browser session ────────────────────────────────────────

  getOlxSession: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        id: userOlxSessions.id,
        loginHint: userOlxSessions.loginHint,
        status: userOlxSessions.status,
        lastVerifiedAt: userOlxSessions.lastVerifiedAt,
        lastOperationAt: userOlxSessions.lastOperationAt,
        createdAt: userOlxSessions.createdAt,
        updatedAt: userOlxSessions.updatedAt,
      })
      .from(userOlxSessions)
      .where(eq(userOlxSessions.userId, ctx.session.user.id))
      .limit(1);

    return {
      browserAvailable: Boolean(resolveOlxBrowserExecutable()),
      session: rows[0] ?? null,
    };
  }),

  connectOlxSession: protectedProcedure
    .input(
      z.object({
        login: z.string().trim().min(1).max(255),
        password: z.string().min(1).max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const attemptsKey = `olx-login-attempts:${userId}`;
      const cooldownKey = `olx-login-cooldown:${userId}`;

      if (
        (await isRateLimited(attemptsKey, 3)) ||
        (await hasActiveRecord(cooldownKey))
      ) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message:
            "Слишком много попыток подключения OLX.uz. Подождите минуту и попробуйте снова.",
        });
      }

      await Promise.all([
        recordAttempt(attemptsKey, OLX_LOGIN_WINDOW_MS),
        setMarker(cooldownKey, OLX_LOGIN_COOLDOWN_MS),
      ]);

      try {
        const connected = await connectOlxBrowserSession(input);
        const encryptedStorageState = encryptOlxStorageState(
          connected.storageState,
          env.AUTH_SECRET,
        );
        const now = new Date();
        const existing = await ctx.db
          .select({ id: userOlxSessions.id })
          .from(userOlxSessions)
          .where(eq(userOlxSessions.userId, userId))
          .limit(1);

        if (existing[0]) {
          await ctx.db
            .update(userOlxSessions)
            .set({
              encryptedStorageState,
              loginHint: connected.loginHint,
              status: "connected",
              lastVerifiedAt: now,
              lastOperationAt: now,
              lastError: null,
            })
            .where(eq(userOlxSessions.id, existing[0].id));
        } else {
          await ctx.db.insert(userOlxSessions).values({
            userId,
            encryptedStorageState,
            loginHint: connected.loginHint,
            status: "connected",
            lastVerifiedAt: now,
            lastOperationAt: now,
          });
        }

        await clearIdentifier(attemptsKey);
        return { success: true };
      } catch (error) {
        throw olxConnectionError(error);
      }
    }),

  verifyOlxSession: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const hourlyKey = `olx-browser-actions:${userId}`;
    const cooldownKey = `olx-verify-cooldown:${userId}`;
    if (
      (await hasActiveRecord(cooldownKey)) ||
      (await isRateLimited(hourlyKey, 10))
    ) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message:
          "Проверять OLX.uz можно не чаще одного раза в 30 секунд. Подождите и повторите.",
      });
    }

    const rows = await ctx.db
      .select()
      .from(userOlxSessions)
      .where(eq(userOlxSessions.userId, ctx.session.user.id))
      .limit(1);
    const session = rows[0];
    if (!session) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "OLX.uz аккаунт не подключён.",
      });
    }

    await Promise.all([
      recordAttempt(hourlyKey, OLX_ACTION_WINDOW_MS),
      setMarker(cooldownKey, OLX_ACTION_COOLDOWN_MS),
    ]);

    let storageState: OlxStorageState;
    try {
      storageState = decryptOlxStorageState<OlxStorageState>(
        session.encryptedStorageState,
        env.AUTH_SECRET,
      );
    } catch {
      await ctx.db
        .update(userOlxSessions)
        .set({
          status: "reauth_required",
          lastOperationAt: new Date(),
          lastError: "session_decryption_failed",
        })
        .where(eq(userOlxSessions.id, session.id));
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message:
          "Сохранённая сессия OLX.uz больше недействительна. Подключите аккаунт заново.",
      });
    }

    try {
      const connected = await verifyOlxBrowserSession({ storageState });
      const now = new Date();
      await ctx.db
        .update(userOlxSessions)
        .set({
          status: connected ? "connected" : "reauth_required",
          lastVerifiedAt: connected ? now : session.lastVerifiedAt,
          lastOperationAt: now,
          lastError: connected ? null : "OLX browser session expired",
        })
        .where(eq(userOlxSessions.id, session.id));
      return { connected };
    } catch (error) {
      if (error instanceof OlxBrowserFlowError) {
        await ctx.db
          .update(userOlxSessions)
          .set({
            status: "reauth_required",
            lastOperationAt: new Date(),
            lastError: error.message,
          })
          .where(eq(userOlxSessions.id, session.id));
      }
      throw olxConnectionError(error);
    }
  }),

  removeOlxSession: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.db
      .delete(userOlxSessions)
      .where(eq(userOlxSessions.userId, ctx.session.user.id));
    return { success: true };
  }),

  // ── Telegram resume warehouse ──────────────────────────────────────

  /**
   * The warehouse vacancy that accumulates resumes ingested from the
   * caller's company's Telegram group. Returns null unless the company has
   * the warehouse feature flag, its own ingestion config
   * (company_telegram_resume_config), and the configured vacancy actually
   * exists in the company — the funnel page is company-scoped, so a link to
   * anything else would dead-end.
   */
  getTelegramResumeVacancy: protectedProcedure.query(async ({ ctx }) => {
    const companyId = await getRequiredCompanyId(ctx.db, ctx.session.user.id);

    const features = await getCompanyFeatures(ctx.db, companyId);
    if (!features.canUseTelegramWarehouse) {
      return null;
    }

    const config = await getTelegramResumeConfigForCompany(ctx.db, companyId);
    if (!config) {
      return null;
    }

    const rows = await ctx.db
      .select({ id: vacancies.id })
      .from(vacancies)
      .where(
        and(
          eq(vacancies.id, config.vacancyId),
          eq(vacancies.companyId, companyId),
        ),
      )
      .limit(1);

    const vacancy = rows[0];
    return vacancy ? { vacancyId: vacancy.id } : null;
  }),

  // ── Telegram channels ──────────────────────────────────────────────

  getTelegramChannels: protectedProcedure.query(async ({ ctx }) => {
    const companyId = await getRequiredCompanyId(ctx.db, ctx.session.user.id);

    const channels = await ctx.db
      .select()
      .from(userTelegramChannels)
      .where(eq(userTelegramChannels.companyId, companyId));

    if (channels.length === 0) {
      return [];
    }

    const admins = await ctx.db
      .select()
      .from(telegramChannelAdmins)
      .where(
        inArray(
          telegramChannelAdmins.channelId,
          channels.map((channel) => channel.id),
        ),
      );

    return channels.map((channel) => ({
      ...channel,
      admins: admins
        .filter((admin) => admin.channelId === channel.id)
        .map((admin) => ({
          id: admin.id,
          username: admin.telegramUsername,
          name: admin.name,
          // The UI needs to warn that an unactivated admin cannot be messaged.
          isActivated: admin.telegramUserId !== null,
          activatedAt: admin.activatedAt,
        })),
    }));
  }),

  /**
   * Previews a channel for the add-channel modal.
   *
   * Lets the recruiter confirm they typed the right handle, and tells them
   * whether direct posting is even available before they pick a delivery mode.
   */
  lookupTelegramChannel: protectedProcedure
    .input(z.object({ channelId: z.string().min(1).max(255) }))
    .mutation(async ({ input }) => {
      if (!isTelegramConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Telegram-бот не настроен.",
        });
      }

      try {
        return await resolveTelegramChannelInfo(input.channelId);
      } catch {
        throw new TRPCError({
          code: "NOT_FOUND",
          message:
            "Канал не найден. Проверьте, что он публичный и логин указан верно.",
        });
      }
    }),

  addTelegramChannel: protectedProcedure
    .input(channelInputSchema)
    .mutation(async ({ ctx, input }) => {
      const companyId = await getRequiredCompanyId(ctx.db, ctx.session.user.id);
      const admins = parseAdmins(input.admins);

      if (input.deliveryMode === "admins" && admins.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Для отправки через администраторов добавьте хотя бы одного администратора.",
        });
      }

      // Title is cosmetic, so a Telegram outage must not block saving.
      const info = await resolveTelegramChannelInfo(input.channelId).catch(
        () => null,
      );

      const rows = await ctx.db
        .insert(userTelegramChannels)
        .values({
          companyId,
          createdByUserId: ctx.session.user.id,
          channelId: input.channelId,
          label: input.label ?? null,
          title: info?.title ?? null,
          deliveryMode: input.deliveryMode,
        })
        .returning();

      const channel = rows[0];
      if (!channel) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Не удалось сохранить канал",
        });
      }

      if (admins.length > 0) {
        await ctx.db.insert(telegramChannelAdmins).values(
          admins.map((admin) => ({
            channelId: channel.id,
            telegramUsername: admin.username,
            name: admin.name,
          })),
        );
      }

      return channel;
    }),

  updateTelegramChannel: protectedProcedure
    .input(channelInputSchema.extend({ id: z.string().min(1).max(255) }))
    .mutation(async ({ ctx, input }) => {
      const companyId = await getRequiredCompanyId(ctx.db, ctx.session.user.id);
      await requireCompanyChannel(ctx.db, input.id, companyId);
      const admins = parseAdmins(input.admins);

      if (input.deliveryMode === "admins" && admins.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Для отправки через администраторов добавьте хотя бы одного администратора.",
        });
      }

      await ctx.db
        .update(userTelegramChannels)
        .set({
          channelId: input.channelId,
          label: input.label ?? null,
          deliveryMode: input.deliveryMode,
        })
        .where(eq(userTelegramChannels.id, input.id));

      const existing = await ctx.db
        .select()
        .from(telegramChannelAdmins)
        .where(eq(telegramChannelAdmins.channelId, input.id));

      const keep = new Set(admins.map((admin) => admin.username));
      const removed = existing.filter(
        (admin) => !keep.has(admin.telegramUsername),
      );
      if (removed.length > 0) {
        await ctx.db.delete(telegramChannelAdmins).where(
          inArray(
            telegramChannelAdmins.id,
            removed.map((admin) => admin.id),
          ),
        );
      }

      for (const admin of admins) {
        const previous = existing.find(
          (row) => row.telegramUsername === admin.username,
        );
        if (previous) {
          // Only the display name is editable — rewriting the username would
          // discard an activation the admin already completed.
          await ctx.db
            .update(telegramChannelAdmins)
            .set({ name: admin.name })
            .where(eq(telegramChannelAdmins.id, previous.id));
        } else {
          await ctx.db.insert(telegramChannelAdmins).values({
            channelId: input.id,
            telegramUsername: admin.username,
            name: admin.name,
          });
        }
      }

      return { success: true };
    }),

  removeTelegramChannel: protectedProcedure
    .input(z.object({ id: z.string().min(1).max(255) }))
    .mutation(async ({ ctx, input }) => {
      const companyId = await getRequiredCompanyId(ctx.db, ctx.session.user.id);

      const deleted = await ctx.db
        .delete(userTelegramChannels)
        .where(
          and(
            eq(userTelegramChannels.id, input.id),
            eq(userTelegramChannels.companyId, companyId),
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
