import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { env } from "~/env";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { userHhAccounts, userTelegramChannels } from "~/server/db/schema";

export const integrationsRouter = createTRPCRouter({
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
      const rows = await ctx.db
        .insert(userTelegramChannels)
        .values({
          userId: ctx.session.user.id,
          channelId: input.channelId,
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
