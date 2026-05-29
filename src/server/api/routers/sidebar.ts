import { and, count, eq, gt } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { candidates, users, vacancies } from "~/server/db/schema";

/**
 * Sidebar router — powers the "new since you last looked" badges.
 *
 * `counts` derives the badge numbers from each row's `createdAt` against a
 * per-user "seen at" timestamp; `markSeen` advances that timestamp so opening
 * the page clears the badge.
 */
export const sidebarRouter = createTRPCRouter({
  counts: protectedProcedure.query(async ({ ctx }) => {
    const userRows = await ctx.db
      .select({
        companyId: users.companyId,
        candidatesSeenAt: users.candidatesSeenAt,
        vacanciesSeenAt: users.vacanciesSeenAt,
      })
      .from(users)
      .where(eq(users.id, ctx.session.user.id))
      .limit(1);

    const user = userRows[0];
    if (!user?.companyId) {
      return { newCandidates: 0, newVacancies: 0 };
    }

    const [candidateRows, vacancyRows] = await Promise.all([
      ctx.db
        .select({ total: count() })
        .from(candidates)
        .where(
          and(
            eq(candidates.companyId, user.companyId),
            gt(candidates.createdAt, user.candidatesSeenAt),
          ),
        ),
      ctx.db
        .select({ total: count() })
        .from(vacancies)
        .where(
          and(
            eq(vacancies.companyId, user.companyId),
            // Base vacancies only — per-channel publications are not "new vacancies".
            eq(vacancies.isPublication, false),
            gt(vacancies.createdAt, user.vacanciesSeenAt),
          ),
        ),
    ]);

    return {
      newCandidates: candidateRows[0]?.total ?? 0,
      newVacancies: vacancyRows[0]?.total ?? 0,
    };
  }),

  markSeen: protectedProcedure
    .input(z.object({ section: z.enum(["candidates", "vacancies"]) }))
    .mutation(async ({ ctx, input }) => {
      const now = new Date();
      await ctx.db
        .update(users)
        .set(
          input.section === "candidates"
            ? { candidatesSeenAt: now }
            : { vacanciesSeenAt: now },
        )
        .where(eq(users.id, ctx.session.user.id));

      return { success: true };
    }),
});
