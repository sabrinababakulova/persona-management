import { ilike } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { vacancies } from "~/server/db/schema";

export const vacanciesRouter = createTRPCRouter({
  getAllVacancies: publicProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db.select().from(vacancies);

    return rows.map((v) => ({
      id: v.id,
      title: v.title,
      level: v.level ?? "",
      status: v.status as "active" | "draft" | "paused" | "closed" | "archive",
      city: v.city ?? "",
      responses: v.responses ?? 0,
      workType: v.workType ?? "",
    }));
  }),

  searchVacancies: publicProcedure
    .input(z.object({ query: z.string() }))
    .query(async ({ ctx, input }) => {
      const rows = input.query
        ? await ctx.db
            .select()
            .from(vacancies)
            .where(ilike(vacancies.title, `%${input.query}%`))
        : await ctx.db.select().from(vacancies);

      return rows.map((v) => ({
        id: v.id,
        title: v.title,
        level: v.level ?? "",
        status: v.status as
          | "active"
          | "draft"
          | "paused"
          | "closed"
          | "archive",
        city: v.city ?? "",
        responses: v.responses ?? 0,
        workType: v.workType ?? "",
      }));
    }),
});
