import { TRPCError } from "@trpc/server";
import { and, count, desc, eq, ilike, notInArray, or } from "drizzle-orm";

import { getOptionalCompanyId } from "~/server/api/router-utils/company";
import { escapeLike } from "~/server/api/router-utils/sql";
import { protectedProcedure } from "~/server/api/trpc";
import {
  candidateStatusOptions,
  candidates,
  candidateVacancies,
  vacancies,
} from "~/server/db/schema";

import {
  vacancyAssignCandidateInputSchema,
  vacancyCandidateSearchInputSchema,
} from "./schemas";
import { isHhVacancyId, isUserVisibleOrWarehouseVacancy } from "./shared";

export const searchVacancyCandidatesProcedure = protectedProcedure
  .input(vacancyCandidateSearchInputSchema)
  .query(async ({ ctx, input }) => {
    const search = input.query.trim();
    const limit = input.limit ?? 8;
    const offset = input.offset ?? 0;

    const userCompanyId = await getOptionalCompanyId(
      ctx.db,
      ctx.session?.user?.id,
    );

    if (!userCompanyId || isHhVacancyId(input.vacancyId)) {
      return {
        items: [],
        total: 0,
      };
    }

    const vacancyRows = await ctx.db
      .select({ id: vacancies.id })
      .from(vacancies)
      .where(
        and(
          eq(vacancies.id, input.vacancyId),
          eq(vacancies.companyId, userCompanyId),
          isUserVisibleOrWarehouseVacancy(input.vacancyId),
        ),
      )
      .limit(1);

    if (!vacancyRows[0]) {
      return {
        items: [],
        total: 0,
      };
    }

    const assignedCandidateRows = await ctx.db
      .select({ candidateId: candidateVacancies.candidateId })
      .from(candidateVacancies)
      .where(eq(candidateVacancies.vacancyId, input.vacancyId));

    const assignedCandidateIds = assignedCandidateRows.map(
      (row) => row.candidateId,
    );

    const conditions = [eq(candidates.companyId, userCompanyId)];

    if (assignedCandidateIds.length > 0) {
      conditions.push(notInArray(candidates.id, assignedCandidateIds));
    }

    if (search) {
      const searchCondition = or(
        ilike(candidates.fullName, `%${escapeLike(search)}%`),
        ilike(candidates.city, `%${escapeLike(search)}%`),
        ilike(candidates.currentPosition, `%${escapeLike(search)}%`),
      );

      if (!searchCondition) {
        return {
          items: [],
          total: 0,
        };
      }

      conditions.push(searchCondition);
    }

    const whereClause = and(...conditions);

    const [rows, totalRows] = await Promise.all([
      ctx.db
        .select({
          id: candidates.id,
          fullName: candidates.fullName,
          city: candidates.city,
          currentPosition: candidates.currentPosition,
          status: candidates.status,
          source: candidates.source,
        })
        .from(candidates)
        .where(whereClause)
        .orderBy(desc(candidates.createdAt))
        .limit(limit)
        .offset(offset),
      ctx.db.select({ total: count() }).from(candidates).where(whereClause),
    ]);

    return {
      items: rows.map((candidate) => ({
        id: candidate.id,
        fullName: candidate.fullName,
        city: candidate.city ?? "",
        currentPosition: candidate.currentPosition ?? "",
        status: candidate.status ?? "new",
        source: candidate.source ?? "",
      })),
      total: totalRows[0]?.total ?? 0,
    };
  });

export const assignCandidateProcedure = protectedProcedure
  .input(vacancyAssignCandidateInputSchema)
  .mutation(async ({ ctx, input }) => {
    const userCompanyId = await getOptionalCompanyId(
      ctx.db,
      ctx.session.user.id,
    );

    if (!userCompanyId || isHhVacancyId(input.vacancyId)) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Вакансия не найдена",
      });
    }

    const [vacancyRows, candidateRows, statusRows, existingRows] =
      await Promise.all([
        ctx.db
          .select({ id: vacancies.id })
          .from(vacancies)
          .where(
            and(
              eq(vacancies.id, input.vacancyId),
              eq(vacancies.companyId, userCompanyId),
              isUserVisibleOrWarehouseVacancy(input.vacancyId),
            ),
          )
          .limit(1),
        ctx.db
          .select({
            id: candidates.id,
            status: candidates.status,
          })
          .from(candidates)
          .where(
            and(
              eq(candidates.id, input.candidateId),
              eq(candidates.companyId, userCompanyId),
            ),
          )
          .limit(1),
        ctx.db
          .select({ value: candidateStatusOptions.value })
          .from(candidateStatusOptions)
          .where(
            and(
              eq(candidateStatusOptions.value, input.status),
              eq(candidateStatusOptions.isActive, true),
            ),
          )
          .limit(1),
        ctx.db
          .select({ id: candidateVacancies.id })
          .from(candidateVacancies)
          .where(
            and(
              eq(candidateVacancies.vacancyId, input.vacancyId),
              eq(candidateVacancies.candidateId, input.candidateId),
            ),
          )
          .limit(1),
      ]);

    if (!vacancyRows[0]) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Вакансия не найдена",
      });
    }

    const candidate = candidateRows[0];
    if (!candidate) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Кандидат не найден",
      });
    }

    if (!statusRows[0]) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Некорректный статус кандидата",
      });
    }

    if (!existingRows[0]) {
      await ctx.db.insert(candidateVacancies).values({
        candidateId: input.candidateId,
        vacancyId: input.vacancyId,
      });
    }

    if (candidate.status !== input.status) {
      await ctx.db
        .update(candidates)
        .set({
          status: input.status,
          updatedAt: new Date(),
        })
        .where(eq(candidates.id, input.candidateId));
    }

    return {
      success: true,
    };
  });
