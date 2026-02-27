import { desc, eq, ilike } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { recentActivityLogs, vacancies } from "~/server/db/schema";

function escapeLike(value: string) {
  return value.replace(/[%_\\]/g, "\\$&");
}

export const vacanciesRouter = createTRPCRouter({
  getAllVacancies: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(100).optional(),
          offset: z.number().min(0).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 50;
      const offset = input?.offset ?? 0;

      const rows = await ctx.db
        .select()
        .from(vacancies)
        .orderBy(desc(vacancies.createdAt))
        .limit(limit)
        .offset(offset);

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
        tasks: v.tasks ?? "",
        team: v.team ?? "",
        companyDescription: v.companyDescription ?? "",
      }));
    }),

  getVacancyById: protectedProcedure
    .input(z.object({ id: z.string().min(1).max(255) }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(vacancies)
        .where(eq(vacancies.id, input.id))
        .limit(1);

      const vacancy = rows[0];
      if (!vacancy) {
        return null;
      }

      return {
        id: vacancy.id,
        title: vacancy.title,
        level: vacancy.level ?? "",
        status: vacancy.status as
          | "active"
          | "draft"
          | "paused"
          | "closed"
          | "archive",
        city: vacancy.city ?? "",
        responses: vacancy.responses ?? 0,
        workType: vacancy.workType ?? "",
        tasks: vacancy.tasks ?? "",
        team: vacancy.team ?? "",
        companyDescription: vacancy.companyDescription ?? "",
      };
    }),

  searchVacancies: protectedProcedure
    .input(z.object({ query: z.string().max(255) }))
    .query(async ({ ctx, input }) => {
      const search = input.query.trim();
      const rows = search
        ? await ctx.db
            .select()
            .from(vacancies)
            .where(ilike(vacancies.title, `%${escapeLike(search)}%`))
            .limit(50)
        : await ctx.db.select().from(vacancies).limit(50);

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
        tasks: v.tasks ?? "",
        team: v.team ?? "",
        companyDescription: v.companyDescription ?? "",
      }));
    }),

  createVacancy: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1, "Название вакансии обязательно").max(255),
        level: z.string().max(100).optional(),
        status: z
          .enum(["active", "draft", "paused", "closed", "archive"])
          .default("active"),
        city: z.string().max(255).optional(),
        responses: z.number().int().min(0).default(0),
        workType: z.string().max(100).optional(),
        tasks: z.string().max(4000).optional(),
        team: z.string().max(4000).optional(),
        companyDescription: z.string().max(8000).optional(),
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
          tasks: input.tasks ?? null,
          team: input.team ?? null,
          companyDescription: input.companyDescription ?? null,
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
        tasks: created.tasks ?? "",
        team: created.team ?? "",
        companyDescription: created.companyDescription ?? "",
      };
    }),

  updateVacancy: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1).max(255),
        title: z.string().min(1).max(255).optional(),
        level: z.string().max(100).optional(),
        status: z
          .enum(["active", "draft", "paused", "closed", "archive"])
          .optional(),
        city: z.string().max(255).optional(),
        responses: z.number().int().min(0).optional(),
        workType: z.string().max(100).optional(),
        tasks: z.string().max(4000).optional(),
        team: z.string().max(4000).optional(),
        companyDescription: z.string().max(8000).optional(),
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
        tasks: string | null;
        team: string | null;
        companyDescription: string | null;
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

      if (input.tasks !== undefined && input.tasks !== (existing.tasks ?? "")) {
        valuesToUpdate.tasks = input.tasks || null;
      }

      if (input.team !== undefined && input.team !== (existing.team ?? "")) {
        valuesToUpdate.team = input.team || null;
      }

      if (
        input.companyDescription !== undefined &&
        input.companyDescription !== (existing.companyDescription ?? "")
      ) {
        valuesToUpdate.companyDescription = input.companyDescription || null;
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
        tasks: updated.tasks ?? "",
        team: updated.team ?? "",
        companyDescription: updated.companyDescription ?? "",
      };
    }),
});
