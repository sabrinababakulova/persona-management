import { and, eq, gte, ilike, inArray, or } from "drizzle-orm";

import { getRequiredCompanyId } from "~/server/api/router-utils/company";
import { getPeriodDateCutoff } from "~/server/api/router-utils/period";
import { escapeLike } from "~/server/api/router-utils/sql";
import { protectedProcedure } from "~/server/api/trpc";
import { vacancies } from "~/server/db/schema";
import {
  fetchCompanyHhVacancies,
  fetchCompanyHhVacanciesPage,
} from "~/server/services/hh";
import { resolveCompanyHhAuth } from "~/server/services/hh-company-account";
import { DEFAULT_COMPANY_ID } from "~/shared/default-company";

import { vacancyListInputSchema } from "./schemas";
import {
  formatHhVacancy,
  formatVacancy,
  getVacancyResponseCounts,
} from "./shared";

export const hasAnyVacanciesProcedure = protectedProcedure.query(
  async ({ ctx }) => {
    const userCompanyId = await getRequiredCompanyId(
      ctx.db,
      ctx.session?.user?.id,
    );

    const localRows = await ctx.db
      .select({ id: vacancies.id })
      .from(vacancies)
      .where(eq(vacancies.companyId, userCompanyId))
      .limit(1);

    if (localRows.length > 0) {
      return true;
    }

    if (userCompanyId !== DEFAULT_COMPANY_ID) {
      return false;
    }

    const hhAccount = await resolveCompanyHhAuth(ctx.db, userCompanyId);
    if (!hhAccount?.accessToken || !hhAccount.employerId) {
      return false;
    }

    try {
      const hhPage = await fetchCompanyHhVacanciesPage({
        accessToken: hhAccount.accessToken,
        employerId: hhAccount.employerId,
        limit: 1,
        offset: 0,
      });
      return hhPage.total > 0;
    } catch {
      return false;
    }
  },
);

export const listVacanciesProcedure = protectedProcedure
  .input(vacancyListInputSchema)
  .query(async ({ ctx, input }) => {
    const period = input?.period ?? "week";
    const search = input?.search?.trim();
    const shouldApplyPeriod = !search;
    const normalizedSearch = search?.toLowerCase() ?? "";
    const statuses = input?.statuses?.filter(Boolean) ?? [];
    const city = input?.city?.trim();
    const normalizedCity = city?.toLowerCase() ?? "";
    const sources = input?.sources?.filter(Boolean) ?? [];
    const limit = input?.limit ?? 50;
    const offset = input?.offset ?? 0;
    const createdAtCutoff = getPeriodDateCutoff(period);
    const userCompanyId = await getRequiredCompanyId(
      ctx.db,
      ctx.session?.user?.id,
    );

    const includeLocal = sources.length === 0 || sources.includes("local");
    const includeHh = sources.length === 0 || sources.includes("hh.uz");

    let localVacancies: ReturnType<typeof formatVacancy>[] = [];

    if (includeLocal) {
      const localConditions = [eq(vacancies.companyId, userCompanyId)];

      if (shouldApplyPeriod) {
        localConditions.push(gte(vacancies.createdAt, createdAtCutoff));
      }

      if (search) {
        const searchCondition = or(
          ilike(vacancies.title, `%${escapeLike(search)}%`),
          ilike(vacancies.level, `%${escapeLike(search)}%`),
          ilike(vacancies.city, `%${escapeLike(search)}%`),
          ilike(vacancies.workType, `%${escapeLike(search)}%`),
        );

        if (searchCondition) {
          localConditions.push(searchCondition);
        }
      }

      if (statuses.length > 0) {
        localConditions.push(inArray(vacancies.status, statuses));
      }

      if (city) {
        localConditions.push(eq(vacancies.city, city));
      }

      const rows = await ctx.db
        .select()
        .from(vacancies)
        .where(and(...localConditions))
        .orderBy(vacancies.createdAt);

      const responseCounts = await getVacancyResponseCounts(
        ctx.db,
        rows.map((row) => row.id),
      );
      localVacancies = rows
        .sort((left, right) => {
          const leftTime = left.createdAt
            ? new Date(left.createdAt).getTime()
            : 0;
          const rightTime = right.createdAt
            ? new Date(right.createdAt).getTime()
            : 0;
          return rightTime - leftTime;
        })
        .map((row) => formatVacancy(row, responseCounts.get(row.id) ?? 0));
    }

    if (userCompanyId !== DEFAULT_COMPANY_ID || !includeHh) {
      return {
        items: localVacancies.slice(offset, offset + limit),
        total: localVacancies.length,
      };
    }

    const hhAccount = await resolveCompanyHhAuth(ctx.db, userCompanyId);
    if (!hhAccount?.accessToken || !hhAccount.employerId) {
      return {
        items: localVacancies.slice(offset, offset + limit),
        total: localVacancies.length,
      };
    }

    const paginatedLocalVacancies = localVacancies.slice(
      offset,
      offset + limit,
    );
    const hhOffset = Math.max(0, offset - localVacancies.length);
    const hhLimit = Math.max(0, limit - paginatedLocalVacancies.length);
    const shouldUsePaginatedHhFetch = !normalizedSearch && !normalizedCity;
    const includeActiveHhStatuses =
      statuses.length === 0 || statuses.includes("active");
    const includeArchivedHhStatuses =
      statuses.length === 0 || statuses.includes("archive");

    try {
      if (shouldUsePaginatedHhFetch) {
        const hhPage = await fetchCompanyHhVacanciesPage({
          accessToken: hhAccount.accessToken,
          employerId: hhAccount.employerId,
          includeActive: includeActiveHhStatuses,
          includeArchived: includeArchivedHhStatuses,
          limit: hhLimit,
          offset: hhOffset,
        });

        return {
          items: [
            ...paginatedLocalVacancies,
            ...hhPage.items.map((vacancy) =>
              formatHhVacancy(vacancy, userCompanyId),
            ),
          ],
          total: localVacancies.length + hhPage.total,
        };
      }

      const hhVacancies = await fetchCompanyHhVacancies(
        hhAccount.employerId,
        hhAccount.accessToken,
      );
      const filteredHhVacancies = hhVacancies
        .map((vacancy) => formatHhVacancy(vacancy, userCompanyId))
        .filter((vacancy) => {
          if (statuses.length > 0 && !statuses.includes(vacancy.status)) {
            return false;
          }

          if (
            normalizedCity &&
            vacancy.city.trim().toLowerCase() !== normalizedCity
          ) {
            return false;
          }

          if (!normalizedSearch) {
            return true;
          }

          const combinedValue =
            `${vacancy.title} ${vacancy.level} ${vacancy.city} ${vacancy.source} ${vacancy.workType}`.toLowerCase();

          return combinedValue.includes(normalizedSearch);
        });

      const items = [...localVacancies, ...filteredHhVacancies];

      return {
        items: items.slice(offset, offset + limit),
        total: items.length,
      };
    } catch (error) {
      console.error("Failed to fetch hh.uz vacancies for company", {
        companyId: userCompanyId,
        employerId: hhAccount.employerId,
        error,
      });

      return {
        items: localVacancies.slice(offset, offset + limit),
        total: localVacancies.length,
      };
    }
  });
