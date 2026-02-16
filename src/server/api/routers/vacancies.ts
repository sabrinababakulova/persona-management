import { eq, ilike } from "drizzle-orm";
import { z } from "zod";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { recentActivityLogs, vacancies } from "~/server/db/schema";

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

  createVacancy: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1, "Название вакансии обязательно"),
        level: z.string().optional(),
        status: z
          .enum(["active", "draft", "paused", "closed", "archive"])
          .default("active"),
        city: z.string().optional(),
        responses: z.number().int().min(0).default(0),
        workType: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const createdRows = await ctx.db
        .insert(vacancies)
        .values({
          title: input.title,
          level: input.level ?? null,
          status: input.status,
          city: input.city ?? null,
          responses: input.responses,
          workType: input.workType ?? null,
        })
        .returning();

      const created = createdRows[0];
      if (!created) {
        const { TRPCError } = await import("@trpc/server");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create vacancy",
        });
      }

      const actorName =
        ctx.session?.user?.name ?? ctx.session?.user?.email ?? "Система";

      try {
        await ctx.db.insert(recentActivityLogs).values({
          entityType: "vacancy",
          entityId: created.id,
          actorUserId: ctx.session?.user?.id ?? null,
          actorName,
          action: "Создал(а) вакансию",
          targetName: created.title,
          targetStatus: "Создана",
        });
      } catch (error) {
        console.error(
          "Failed to write recent activity log for vacancy creation",
          error,
        );
      }

      return {
        id: created.id,
        title: created.title,
        level: created.level ?? "",
        status: created.status as
          | "active"
          | "draft"
          | "paused"
          | "closed"
          | "archive",
        city: created.city ?? "",
        responses: created.responses ?? 0,
        workType: created.workType ?? "",
      };
    }),

  updateVacancy: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        title: z.string().min(1).optional(),
        level: z.string().optional(),
        status: z
          .enum(["active", "draft", "paused", "closed", "archive"])
          .optional(),
        city: z.string().optional(),
        responses: z.number().int().min(0).optional(),
        workType: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { TRPCError } = await import("@trpc/server");

      const rows = await ctx.db
        .select()
        .from(vacancies)
        .where(eq(vacancies.id, input.id))
        .limit(1);

      const existing = rows[0];
      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Vacancy not found",
        });
      }

      const valuesToUpdate: Partial<{
        title: string;
        level: string | null;
        status: "active" | "draft" | "paused" | "closed" | "archive";
        city: string | null;
        responses: number;
        workType: string | null;
      }> = {};

      if (input.title && input.title !== existing.title) {
        valuesToUpdate.title = input.title;
      }

      if (input.level !== undefined && input.level !== (existing.level ?? "")) {
        valuesToUpdate.level = input.level || null;
      }

      if (input.status && input.status !== (existing.status ?? "active")) {
        valuesToUpdate.status = input.status;
      }

      if (input.city !== undefined && input.city !== (existing.city ?? "")) {
        valuesToUpdate.city = input.city || null;
      }

      if (
        input.responses !== undefined &&
        input.responses !== (existing.responses ?? 0)
      ) {
        valuesToUpdate.responses = input.responses;
      }

      if (
        input.workType !== undefined &&
        input.workType !== (existing.workType ?? "")
      ) {
        valuesToUpdate.workType = input.workType || null;
      }

      if (Object.keys(valuesToUpdate).length === 0) {
        return existing;
      }

      const updatedRows = await ctx.db
        .update(vacancies)
        .set(valuesToUpdate)
        .where(eq(vacancies.id, input.id))
        .returning();

      const updated = updatedRows[0];
      if (!updated) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update vacancy",
        });
      }

      const actorName =
        ctx.session?.user?.name ?? ctx.session?.user?.email ?? "Система";
      const changedStatus = valuesToUpdate.status ?? null;

      try {
        await ctx.db.insert(recentActivityLogs).values({
          entityType: "vacancy",
          entityId: updated.id,
          actorUserId: ctx.session?.user?.id ?? null,
          actorName,
          action: changedStatus
            ? "Изменил(а) статус вакансии"
            : "Обновил(а) вакансию",
          targetName: updated.title,
          targetStatus: changedStatus ?? "Профиль обновлен",
        });
      } catch (error) {
        console.error("Failed to write recent activity log for vacancy", error);
      }

      return {
        id: updated.id,
        title: updated.title,
        level: updated.level ?? "",
        status: updated.status as
          | "active"
          | "draft"
          | "paused"
          | "closed"
          | "archive",
        city: updated.city ?? "",
        responses: updated.responses ?? 0,
        workType: updated.workType ?? "",
      };
    }),
});
