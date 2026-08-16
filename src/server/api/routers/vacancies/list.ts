import type { SQL } from "drizzle-orm";
import { and, desc, eq, gte, ilike, inArray, isNotNull, or } from "drizzle-orm";

import { getRequiredCompanyId } from "~/server/api/router-utils/company";
import { getPeriodDateCutoff } from "~/server/api/router-utils/period";
import { escapeLike } from "~/server/api/router-utils/sql";
import { protectedProcedure } from "~/server/api/trpc";
import { vacancies } from "~/server/db/schema";
import {
  fetchCompanyHhVacancies,
  fetchCompanyHhVacanciesPage,
  fetchHhVacancyResponseCounts,
  isHhAuthenticationError,
} from "~/server/services/hh";
import { resolveUserHhAuth } from "~/server/services/hh-company-account";

import { vacancyListInputSchema } from "./schemas";
import {
  formatHhVacancy,
  formatVacancy,
  getVacancyPublicationChannels,
  getVacancyResponseCounts,
  isUserVisibleVacancy,
} from "./shared";

type HhUnavailableReason = "authenticationExpired" | "unavailable";

/**
 * Builds the SQL predicate that restricts local `vacancies` rows to the requested sources:
 *
 * - **hh.uz only** — rows linked to an hh.uz vacancy (`hhVacancyId` is set).
 * - **both sources explicitly selected** — base vacancies or hh.uz-linked rows.
 * - **default / local only** — base vacancies (`isPublication = false`).
 */
function localSourceCondition(
  wantsLocalSource: boolean,
  wantsHhSource: boolean,
  sourceCount: number,
): SQL | undefined {
  if (wantsHhSource && !wantsLocalSource) {
    return isNotNull(vacancies.hhVacancyId);
  }
  if (wantsLocalSource && wantsHhSource && sourceCount > 0) {
    return or(
      eq(vacancies.isPublication, false),
      isNotNull(vacancies.hhVacancyId),
    );
  }
  return eq(vacancies.isPublication, false);
}

/**
 * Overrides each local vacancy's response count with the live hh.uz counter, looked up by
 * `hhVacancyId` in `hhResponsesById`.
 *
 * A linked hh.uz vacancy is deduped out of the merged list, so without this its response
 * count — which only hh.uz tracks accurately — would never reach the client. Copying it
 * onto the local vacancy keeps the displayed counter correct.
 */
function withHhResponseCounts(
  localVacancies: ReturnType<typeof formatVacancy>[],
  hhResponsesById: Map<string, number>,
) {
  if (hhResponsesById.size === 0) {
    return localVacancies;
  }
  return localVacancies.map((vacancy) => {
    const hhResponses = vacancy.hhVacancyId
      ? hhResponsesById.get(vacancy.hhVacancyId)
      : undefined;
    return hhResponses === undefined
      ? vacancy
      : { ...vacancy, responses: hhResponses };
  });
}

/**
 * `vacancies.list` — paginated vacancy list for the signed-in user's company.
 *
 * Results are merged from two sources, selected through the `sources` filter (an empty
 * filter means "any source"):
 *
 * - **Local** — vacancies stored in our own database.
 * - **hh.uz** — vacancies fetched live from the hh.uz API.
 *
 * Local vacancies are listed first, then hh.uz vacancies. An hh.uz vacancy already linked
 * to a local vacancy (matched by `hhVacancyId`) is dropped so it is not shown twice — but
 * its hh.uz response counter is copied onto the local vacancy first.
 * `limit`/`offset` paginate the merged list. If the hh.uz API call fails, the procedure
 * degrades gracefully and returns only the local results.
 *
 * Archived hh.uz vacancies live entirely in the local DB — the discovery cron persists them
 * as stubs (id, title, status="archive") and this procedure never asks the hh.uz API for
 * them. Active hh.uz vacancies still pass through the live API merge so brand-new ones
 * appear before the next sync run.
 *
 * Supported filters: `search` (title / description), `statuses`, `city` (matched against an
 * hh.uz `areaId`) and `period`. `period` is ignored while a text search is active.
 */
export const listVacanciesProcedure = protectedProcedure
  .input(vacancyListInputSchema)
  .query(async ({ ctx, input }) => {
    const search = input?.search?.trim();
    const normalizedSearch = search?.toLowerCase() ?? "";
    const statuses = input?.statuses?.filter(Boolean) ?? [];
    const city = input?.city?.trim();
    const normalizedCity = city?.toLowerCase() ?? "";
    const sources = input?.sources?.filter(Boolean) ?? [];
    const limit = input?.limit ?? 50;
    const offset = input?.offset ?? 0;

    const userCompanyId = await getRequiredCompanyId(
      ctx.db,
      ctx.session?.user?.id,
    );

    // An empty `sources` filter means "any source".
    const wantsLocalSource = sources.length === 0 || sources.includes("local");
    const wantsHhSource = sources.length === 0 || sources.includes("hh.uz");
    // Local rows are also needed for an hh.uz-only request: they identify which hh.uz
    // vacancies are already linked locally and must be deduped out of the hh.uz feed.
    const includeLocal = wantsLocalSource || sources.includes("hh.uz");

    /** Applies the request's `limit`/`offset` window to a result list. */
    const paginate = <T>(items: T[]) => items.slice(offset, offset + limit);

    // --- Local vacancies ------------------------------------------------------------
    let localVacancies: ReturnType<typeof formatVacancy>[] = [];

    if (includeLocal) {
      const conditions: (SQL | undefined)[] = [
        eq(vacancies.companyId, userCompanyId),
        isUserVisibleVacancy(),
        localSourceCondition(wantsLocalSource, wantsHhSource, sources.length),
      ];

      if (search) {
        conditions.push(
          or(
            ilike(vacancies.title, `%${escapeLike(search)}%`),
            ilike(vacancies.descriptionHtml, `%${escapeLike(search)}%`),
          ),
        );
      } else {
        // The `period` window only applies when there is no text search.
        conditions.push(
          gte(
            vacancies.createdAt,
            getPeriodDateCutoff(input?.period ?? "week"),
          ),
        );
      }
      if (statuses.length > 0) {
        conditions.push(inArray(vacancies.status, statuses));
      }
      if (city) {
        // `city` carries an hh.uz `areaId` — the schema no longer stores a free-text city.
        conditions.push(eq(vacancies.areaId, city));
      }

      const rows = await ctx.db
        .select()
        .from(vacancies)
        .where(and(...conditions))
        .orderBy(desc(vacancies.createdAt));

      const [responseCounts, publicationChannels] = await Promise.all([
        getVacancyResponseCounts(
          ctx.db,
          rows.map((row) => row.id),
        ),
        getVacancyPublicationChannels(
          ctx.db,
          rows.map((row) => row.id),
        ),
      ]);
      localVacancies = rows.map((row) =>
        formatVacancy(
          row,
          responseCounts.get(row.id) ?? 0,
          publicationChannels.get(row.id) ?? [],
        ),
      );
    }

    // Availability metadata distinguishes "hh.uz returned nothing" from a failed
    // integration and lets the UI call out an expired connection separately.
    const localOnlyResult = {
      items: paginate(localVacancies),
      total: localVacancies.length,
      hhUnavailable: false,
      hhUnavailableReason: null as HhUnavailableReason | null,
    };

    // --- hh.uz vacancies ------------------------------------------------------------
    // Bail out to local-only results when hh.uz is not requested or not connected.
    if (!wantsHhSource) {
      return localOnlyResult;
    }

    const hhAccount = await resolveUserHhAuth(ctx.db, ctx.session.user.id);
    if (!hhAccount?.accessToken || !hhAccount.employerId) {
      return localOnlyResult;
    }

    // Every hh.uz id already mirrored by a local vacancy — used to dedupe the hh.uz feed.
    // Archived stubs are tracked separately because they are never returned by the
    // active-only hh.uz fetches below, so they must be excluded from the linked-count math
    // that prevents double-counting active hh.uz vacancies against the local total.
    const linkedRows = await ctx.db
      .select({
        hhVacancyId: vacancies.hhVacancyId,
        status: vacancies.status,
      })
      .from(vacancies)
      .where(
        and(eq(vacancies.companyId, userCompanyId), isUserVisibleVacancy()),
      );
    const linkedHhVacancyIds = new Set(
      linkedRows
        .map((row) => row.hhVacancyId)
        .filter((id): id is string => Boolean(id)),
    );
    const linkedActiveHhVacancyIds = new Set(
      linkedRows
        .filter((row) => row.status !== "archive")
        .map((row) => row.hhVacancyId)
        .filter((id): id is string => Boolean(id)),
    );

    const includeActiveHhStatuses =
      statuses.length === 0 || statuses.includes("active");

    try {
      // Fast path: let hh.uz paginate server-side. Only possible when no search / city
      // filter is active (hh.uz pagination cannot express those) and the caller did not
      // explicitly ask for the hh.uz source on its own.
      const canPaginateOnHhSide =
        !sources.includes("hh.uz") && !normalizedSearch && !normalizedCity;

      if (canPaginateOnHhSide) {
        const paginatedLocal = paginate(localVacancies);
        // The paginated hh.uz page rarely contains the hh.uz vacancies linked to the local
        // rows on this page, so their response counters are fetched directly by id.
        const linkedIdsOnPage = paginatedLocal
          .map((vacancy) => vacancy.hhVacancyId)
          .filter((id): id is string => Boolean(id));

        const [hhPage, hhResponsesById] = await Promise.all([
          fetchCompanyHhVacanciesPage({
            accessToken: hhAccount.accessToken,
            employerId: hhAccount.employerId,
            includeActive: includeActiveHhStatuses,
            // Archived hh.uz vacancies live in our local table now — never ask hh.uz.
            includeArchived: false,
            // Ask hh.uz only for the rows left over after the local slice.
            offset: Math.max(0, offset - localVacancies.length),
            limit: Math.max(0, limit - paginatedLocal.length),
          }),
          fetchHhVacancyResponseCounts(linkedIdsOnPage, hhAccount.accessToken),
        ]);

        const hhItems = hhPage.items
          .filter((vacancy) => !linkedHhVacancyIds.has(vacancy.id))
          .map((vacancy) => formatHhVacancy(vacancy, userCompanyId));
        // `hhPage.total` is the number of ACTIVE hh.uz vacancies. Subtract only the
        // active-linked rows that are already counted via `localVacancies`.
        const linkedHhCount = Math.min(
          linkedActiveHhVacancyIds.size,
          hhPage.total,
        );

        return {
          items: [
            ...withHhResponseCounts(paginatedLocal, hhResponsesById),
            ...hhItems,
          ],
          total: localVacancies.length + hhPage.total - linkedHhCount,
          hhUnavailable: false,
          hhUnavailableReason: null as HhUnavailableReason | null,
        };
      }

      // Slow path: hh.uz cannot filter by search / city, so fetch every active hh.uz
      // vacancy and filter it in memory before merging with the local results. Archived
      // hh.uz vacancies are served exclusively from `localVacancies`.
      const hhVacancies = await fetchCompanyHhVacancies(
        hhAccount.employerId,
        hhAccount.accessToken,
        {
          includeArchived: false,
          throwOnAuthenticationError: true,
        },
      );
      const hhItems = hhVacancies
        .filter((vacancy) => {
          if (linkedHhVacancyIds.has(vacancy.id)) {
            return false;
          }
          if (statuses.length > 0 && !statuses.includes(vacancy.status)) {
            return false;
          }
          if (
            normalizedCity &&
            vacancy.city.trim().toLowerCase() !== normalizedCity
          ) {
            return false;
          }
          if (normalizedSearch) {
            const haystack =
              `${vacancy.title} ${vacancy.level} ${vacancy.city} ${vacancy.workType}`.toLowerCase();
            return haystack.includes(normalizedSearch);
          }
          return true;
        })
        .map((vacancy) => formatHhVacancy(vacancy, userCompanyId));

      // The full hh.uz feed already carries counters, so no extra by-id fetch is needed.
      const hhResponsesById = new Map(
        hhVacancies.map((vacancy) => [vacancy.id, vacancy.responses]),
      );
      const items = [
        ...withHhResponseCounts(localVacancies, hhResponsesById),
        ...hhItems,
      ];
      return {
        items: paginate(items),
        total: items.length,
        hhUnavailable: false,
        hhUnavailableReason: null as HhUnavailableReason | null,
      };
    } catch (error) {
      console.error("Failed to fetch hh.uz vacancies for company", {
        companyId: userCompanyId,
        employerId: hhAccount.employerId,
        error,
      });
      // Degraded, not empty: local rows are still returned so the page works,
      // but the caller is told the hh.uz half of the list is missing.
      return {
        ...localOnlyResult,
        hhUnavailable: true,
        hhUnavailableReason: (isHhAuthenticationError(error)
          ? "authenticationExpired"
          : "unavailable") as HhUnavailableReason | null,
      };
    }
  });
