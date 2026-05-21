import { and, count, eq, inArray } from "drizzle-orm";

import {
  getOptionalCompanyId,
  getRequiredCompanyId,
} from "~/server/api/router-utils/company";
import { protectedProcedure } from "~/server/api/trpc";
import { candidates, hhEnrichmentJobs } from "~/server/db/schema";
import {
  discoverHhCandidates,
  drainHhEnrichmentJobs,
} from "~/server/services/hh";
import { resolveUserHhAuth } from "~/server/services/hh-company-account";

/**
 * Runs hh.uz candidate discovery for the current company (sync Layer 1).
 *
 * Called by the connect/reconnect data-migration screen and any manual "Sync"
 * action. Discovery is bounded by a per-vacancy watermark, so repeat runs are
 * cheap. A small batch of enrichment jobs is drained inline as a warm-up; the
 * rest are handled by the enrichment worker.
 */
export const syncHhCandidatesProcedure = protectedProcedure.mutation(
  async ({ ctx }) => {
    const companyId = await getRequiredCompanyId(ctx.db, ctx.session?.user?.id);
    const hhAuth = await resolveUserHhAuth(ctx.db, ctx.session.user.id);
    const accessToken = hhAuth?.accessToken;

    if (!accessToken) {
      return {
        ranSync: false,
        vacanciesProcessed: 0,
        vacanciesFailed: 0,
        newCandidates: 0,
        newApplications: 0,
        jobsEnqueued: 0,
      };
    }

    const discovery = await discoverHhCandidates({
      db: ctx.db,
      companyId,
      accessToken,
    });

    // Warm up: enrich the first few discovered candidates immediately so the
    // funnel is not all stubs right after a connect. The worker drains the rest.
    try {
      await drainHhEnrichmentJobs({ db: ctx.db, batchSize: 10 });
    } catch (error) {
      console.error("hh enrichment warm-up failed", { companyId, error });
    }

    return discovery;
  },
);

/**
 * Reports outstanding hh.uz enrichment work for the current company.
 *
 * The data-migration screen and candidate views poll this to know when stub
 * candidates have finished enriching.
 */
export const hhSyncStatusProcedure = protectedProcedure.query(
  async ({ ctx }) => {
    const companyId = await getOptionalCompanyId(ctx.db, ctx.session?.user?.id);
    if (!companyId) {
      return { pendingEnrichmentJobs: 0 };
    }

    const rows = await ctx.db
      .select({ total: count() })
      .from(hhEnrichmentJobs)
      .innerJoin(candidates, eq(candidates.id, hhEnrichmentJobs.candidateId))
      .where(
        and(
          eq(candidates.companyId, companyId),
          inArray(hhEnrichmentJobs.status, ["pending", "processing"]),
        ),
      );

    return { pendingEnrichmentJobs: rows[0]?.total ?? 0 };
  },
);
