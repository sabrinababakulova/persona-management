import { and, count, desc, eq, gte, ilike, inArray } from "drizzle-orm";
import { getOptionalCompanyId } from "~/server/api/router-utils/company";
import { getPeriodDateCutoff } from "~/server/api/router-utils/period";
import { escapeLike } from "~/server/api/router-utils/sql";
import { protectedProcedure } from "~/server/api/trpc";
import { candidates } from "~/server/db/schema";

import { candidateListInputSchema } from "./schemas";

/**
 * Lists stored candidates for the current company.
 *
 * Supports search, period filtering, status/source/city filters, and offset
 * pagination. Period filtering is skipped while searching so older matches are
 * still discoverable.
 */
export const listCandidatesProcedure = protectedProcedure
  .input(candidateListInputSchema)
  .query(async ({ ctx, input }) => {
    const period = input?.period ?? "week";
    const search = input?.search?.trim();
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

    if (!search) {
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

    const [rows, totalRows] = await Promise.all([
      ctx.db
        .select()
        .from(candidates)
        .where(and(...conditions))
        .orderBy(desc(candidates.createdAt))
        .limit(limit)
        .offset(offset),
      ctx.db
        .select({ total: count() })
        .from(candidates)
        .where(and(...conditions)),
    ]);

    return {
      items: rows.map((candidate) => {
        const parts = candidate.fullName.split(" ");
        return {
          id: candidate.id,
          name: parts.slice(0, 2).join(" "),
          patronymic: parts.slice(2).join(" "),
          city: candidate.city ?? "",
          status: candidate.status ?? "new",
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

/**
 * Deprecated: hh.uz applicants are now persisted by the candidate sync and are
 * returned by {@link listCandidatesProcedure} like any other candidate.
 *
 * The procedure is kept as an empty page so existing clients that still merge a
 * separate hh.uz list keep working without showing duplicates.
 */
export const listHhCandidatesProcedure = protectedProcedure
  .input(candidateListInputSchema)
  .query(async () => {
    return { items: [], total: 0 };
  });
