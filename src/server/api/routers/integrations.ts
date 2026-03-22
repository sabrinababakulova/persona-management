import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import type { db } from "~/server/db";
import {
  companyHhAccounts,
  companyTelegramChannels,
  users,
} from "~/server/db/schema";

/** Resolve the caller's companyId from the session user. */
async function getCompanyId(
  database: typeof db,
  userId: string,
): Promise<string> {
  const rows = await database
    .select({ companyId: users.companyId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const companyId = rows[0]?.companyId;
  if (!companyId) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "У вас не привязана компания",
    });
  }
  return companyId;
}

export const integrationsRouter = createTRPCRouter({
  // ── Telegram channels ──────────────────────────────────────────────

  getTelegramChannels: protectedProcedure.query(async ({ ctx }) => {
    const companyId = await getCompanyId(ctx.db, ctx.session.user.id);

    return ctx.db
      .select()
      .from(companyTelegramChannels)
      .where(eq(companyTelegramChannels.companyId, companyId));
  }),

  addTelegramChannel: protectedProcedure
    .input(
      z.object({
        channelId: z.string().min(1).max(255),
        label: z.string().max(255).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const companyId = await getCompanyId(ctx.db, ctx.session.user.id);

      const rows = await ctx.db
        .insert(companyTelegramChannels)
        .values({
          companyId,
          channelId: input.channelId,
          label: input.label ?? null,
        })
        .returning();

      return rows[0] ?? null;
    }),

  removeTelegramChannel: protectedProcedure
    .input(z.object({ id: z.string().min(1).max(255) }))
    .mutation(async ({ ctx, input }) => {
      const companyId = await getCompanyId(ctx.db, ctx.session.user.id);

      const deleted = await ctx.db
        .delete(companyTelegramChannels)
        .where(
          and(
            eq(companyTelegramChannels.id, input.id),
            eq(companyTelegramChannels.companyId, companyId),
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
    const companyId = await getCompanyId(ctx.db, ctx.session.user.id);

    const rows = await ctx.db
      .select()
      .from(companyHhAccounts)
      .where(eq(companyHhAccounts.companyId, companyId))
      .limit(1);

    const account = rows[0];
    if (!account) return null;

    // Mask secrets for display
    return {
      id: account.id,
      companyId: account.companyId,
      clientId: account.clientId,
      clientSecret: account.clientSecret
        ? `${"•".repeat(8)}${account.clientSecret.slice(-4)}`
        : null,
      employerId: account.employerId,
      email: account.email,
      hasTokens: !!(account.accessToken && account.refreshToken),
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
      const companyId = await getCompanyId(ctx.db, ctx.session.user.id);

      // Upsert — one hh account per company
      const existing = await ctx.db
        .select({ id: companyHhAccounts.id })
        .from(companyHhAccounts)
        .where(eq(companyHhAccounts.companyId, companyId))
        .limit(1);

      if (existing[0]) {
        await ctx.db
          .update(companyHhAccounts)
          .set({
            clientId: input.clientId,
            clientSecret: input.clientSecret,
            employerId: input.employerId,
            email: input.email ?? null,
          })
          .where(eq(companyHhAccounts.id, existing[0].id));
      } else {
        await ctx.db.insert(companyHhAccounts).values({
          companyId,
          clientId: input.clientId,
          clientSecret: input.clientSecret,
          employerId: input.employerId,
          email: input.email ?? null,
        });
      }

      return { success: true };
    }),

  removeHhAccount: protectedProcedure.mutation(async ({ ctx }) => {
    const companyId = await getCompanyId(ctx.db, ctx.session.user.id);

    await ctx.db
      .delete(companyHhAccounts)
      .where(eq(companyHhAccounts.companyId, companyId));

    return { success: true };
  }),
});
