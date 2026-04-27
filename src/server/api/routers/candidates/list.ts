import { and, count, desc, eq, gte, ilike, inArray } from "drizzle-orm";
import { getOptionalCompanyId } from "~/server/api/router-utils/company";
import { getPeriodDateCutoff } from "~/server/api/router-utils/period";
import { escapeLike } from "~/server/api/router-utils/sql";
import { protectedProcedure } from "~/server/api/trpc";
import { candidates, companyHhAccounts } from "~/server/db/schema";
import {
  fetchCompanyHhVacancies,
  fetchHhVacancyApplicants,
  type HhVacancyApplicant,
  isHhConfigured,
  iterateHhVacancyApplicantBatches,
  refreshHhAccessToken,
} from "~/server/services/hh";
import { DEFAULT_COMPANY_ID } from "~/shared/default-company";
import type { CandidateStatus } from "~/types/server/candidates";

import { candidateListInputSchema } from "./schemas";

export const hasAnyCandidatesProcedure = protectedProcedure.query(
  async ({ ctx }) => {
    const userCompanyId = await getOptionalCompanyId(
      ctx.db,
      ctx.session?.user?.id,
    );

    if (!userCompanyId) {
      return false;
    }

    const rows = await ctx.db
      .select({ id: candidates.id })
      .from(candidates)
      .where(eq(candidates.companyId, userCompanyId))
      .limit(1);

    return rows.length > 0;
  },
);

export const listCandidatesProcedure = protectedProcedure
  .input(candidateListInputSchema)
  .query(async ({ ctx, input }) => {
    const period = input?.period ?? "week";
    const search = input?.search?.trim();
    const shouldApplyPeriod = !search;
    const statuses = input?.statuses?.filter(Boolean) ?? [];
    const city = input?.city?.trim();
    const sources = input?.sources?.filter(Boolean) ?? [];
    const limit = input?.limit ?? 50;
    const offset = input?.offset ?? 0;
    const createdAtCutoff = getPeriodDateCutoff(period);

    const userCompanyId = await getOptionalCompanyId(
      ctx.db,
      ctx.session?.user?.id,
    );

    if (!userCompanyId) {
      return { items: [], total: 0 };
    }

    const conditions = [eq(candidates.companyId, userCompanyId)];

    if (shouldApplyPeriod) {
      conditions.push(gte(candidates.createdAt, createdAtCutoff));
    }
    if (search) {
      conditions.push(ilike(candidates.fullName, `%${escapeLike(search)}%`));
    }
    if (statuses.length > 0) {
      conditions.push(inArray(candidates.status, statuses));
    }
    if (city) {
      conditions.push(eq(candidates.city, city));
    }
    if (sources.length > 0) {
      conditions.push(inArray(candidates.source, sources));
    }

    const whereClause = and(...conditions);

    const [rows, totalRows] = await Promise.all([
      ctx.db
        .select()
        .from(candidates)
        .where(whereClause)
        .orderBy(desc(candidates.createdAt))
        .limit(limit)
        .offset(offset),
      ctx.db.select({ total: count() }).from(candidates).where(whereClause),
    ]);

    return {
      items: rows.map((candidate) => {
        const parts = candidate.fullName.split(" ");
        return {
          id: candidate.id,
          name: parts.slice(0, 2).join(" "),
          patronymic: parts.slice(2).join(" "),
          city: candidate.city ?? "",
          status: (candidate.status ?? "new") as CandidateStatus,
          createdAt: candidate.createdAt
            ? new Date(candidate.createdAt).toLocaleDateString("ru-RU", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })
            : "",
          createdAtValue: candidate.createdAt
            ? new Date(candidate.createdAt).toISOString()
            : "",
          source: candidate.source ?? "",
        };
      }),
      total: totalRows[0]?.total ?? 0,
    };
  });

export const listHhCandidatesProcedure = protectedProcedure
  .input(candidateListInputSchema)
  .query(async ({ ctx, input }) => {
    const userCompanyId = await getOptionalCompanyId(
      ctx.db,
      ctx.session?.user?.id,
    );
    const search = input?.search?.trim().toLowerCase() ?? "";
    const statuses = input?.statuses?.filter(Boolean) ?? [];
    const city = input?.city?.trim();
    const sources = input?.sources?.filter(Boolean) ?? [];
    const limit = input?.limit ?? 50;
    const offset = input?.offset ?? 0;

    if (
      !userCompanyId ||
      userCompanyId !== DEFAULT_COMPANY_ID ||
      !isHhConfigured()
    ) {
      return { items: [], total: 0 };
    }

    if (sources.length > 0 && !sources.includes("hh.uz")) {
      return { items: [], total: 0 };
    }

    if (statuses.length > 0 && !statuses.includes("new")) {
      return { items: [], total: 0 };
    }

    if (city) {
      return { items: [], total: 0 };
    }

    const hhAccountRows = await ctx.db
      .select({
        id: companyHhAccounts.id,
        accessToken: companyHhAccounts.accessToken,
        refreshToken: companyHhAccounts.refreshToken,
        employerId: companyHhAccounts.employerId,
      })
      .from(companyHhAccounts)
      .where(eq(companyHhAccounts.companyId, userCompanyId))
      .limit(1);

    const hhAccount = hhAccountRows[0];
    if (!hhAccount || (!hhAccount.accessToken && !hhAccount.refreshToken)) {
      return { items: [], total: 0 };
    }

    let accessToken = hhAccount.accessToken ?? undefined;
    const refreshToken = hhAccount.refreshToken ?? undefined;
    const employerId = hhAccount.employerId?.trim();

    if (!accessToken && refreshToken && hhAccount.id) {
      try {
        const refreshed = await refreshHhAccessToken(refreshToken);
        accessToken = refreshed.accessToken;
        await ctx.db
          .update(companyHhAccounts)
          .set({
            accessToken: refreshed.accessToken,
            refreshToken: refreshed.refreshToken,
          })
          .where(eq(companyHhAccounts.id, hhAccount.id));
      } catch (error) {
        console.error("Failed to refresh HH token for candidates list", {
          error,
        });
      }
    }

    if (!accessToken || !employerId) {
      return { items: [], total: 0 };
    }

    try {
      const hhVacancies = await fetchCompanyHhVacancies(
        employerId,
        accessToken,
      );
      const importedHhCandidateRows = await ctx.db
        .select({ id: candidates.id })
        .from(candidates)
        .where(
          and(
            eq(candidates.companyId, userCompanyId),
            eq(candidates.source, "hh.uz"),
          ),
        );
      const importedHhCandidateIds = new Set(
        importedHhCandidateRows.map((candidate) => candidate.id),
      );

      const mapApplicantToCandidate = (applicant: HhVacancyApplicant) => {
        const parts = applicant.fullName.split(" ");
        return {
          id: `hh_${applicant.id}`,
          name: parts.slice(0, 2).join(" "),
          patronymic: parts.slice(2).join(" "),
          city: "",
          status: "new" as CandidateStatus,
          createdAt: "",
          createdAtValue: "",
          source: "hh.uz",
        };
      };

      if (search) {
        const applicantsById = new Map<string, HhVacancyApplicant>();

        for (const vacancy of hhVacancies) {
          const applicants = await fetchHhVacancyApplicants(
            vacancy.id,
            accessToken,
          );

          for (const applicant of applicants) {
            const candidateId = `hh_${applicant.id}`;
            if (
              applicantsById.has(applicant.id) ||
              importedHhCandidateIds.has(candidateId)
            ) {
              continue;
            }

            if (!applicant.fullName.toLowerCase().includes(search)) {
              continue;
            }

            applicantsById.set(applicant.id, applicant);
          }
        }

        return {
          items: [...applicantsById.values()]
            .slice(offset, offset + limit)
            .map(mapApplicantToCandidate),
          total: applicantsById.size,
        };
      }

      const items: Array<ReturnType<typeof mapApplicantToCandidate>> = [];
      const seenApplicantIds = new Set<string>();
      let skipped = 0;
      let hasMore = false;

      outer: for (const vacancy of hhVacancies) {
        if (vacancy.responses <= 0) {
          continue;
        }

        for await (const batch of iterateHhVacancyApplicantBatches({
          accessToken,
          vacancyId: vacancy.id,
        })) {
          for (const applicant of batch) {
            const candidateId = `hh_${applicant.id}`;

            if (
              seenApplicantIds.has(candidateId) ||
              importedHhCandidateIds.has(candidateId)
            ) {
              continue;
            }

            seenApplicantIds.add(candidateId);

            if (skipped < offset) {
              skipped += 1;
              continue;
            }

            if (items.length < limit) {
              items.push(mapApplicantToCandidate(applicant));
              continue;
            }

            hasMore = true;
            break outer;
          }
        }
      }

      const hhResponsesEstimate = hhVacancies.reduce(
        (total, vacancy) => total + Math.max(vacancy.responses, 0),
        0,
      );
      const total = Math.max(
        0,
        Math.max(
          hhResponsesEstimate - importedHhCandidateIds.size,
          offset + items.length + (hasMore ? 1 : 0),
        ),
      );

      return { items, total };
    } catch (error) {
      console.error("Failed to fetch hh.uz applicants for candidates list", {
        error,
      });
      return { items: [], total: 0 };
    }
  });
