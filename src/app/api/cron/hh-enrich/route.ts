import { NextResponse } from "next/server";

import { env } from "~/env";
import { db } from "~/server/db";
import {
  type DrainHhEnrichmentResult,
  drainHhEnrichmentJobs,
} from "~/server/services/hh";

/** How many batches one invocation drains before returning. */
const MAX_BATCHES = 5;

/**
 * Drains the hh.uz enrichment queue (sync Layer 2).
 *
 * Intended to be hit by a scheduler. Authorized with the server `AUTH_SECRET`
 * as a bearer token so it cannot be triggered by anonymous traffic.
 */
export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");
  if (authorization !== `Bearer ${env.AUTH_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const totals: DrainHhEnrichmentResult = {
    claimed: 0,
    enriched: 0,
    retried: 0,
    failed: 0,
  };

  try {
    for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
      const result = await drainHhEnrichmentJobs({ db });
      totals.claimed += result.claimed;
      totals.enriched += result.enriched;
      totals.retried += result.retried;
      totals.failed += result.failed;
      if (result.claimed === 0) {
        break;
      }
    }
  } catch (error) {
    console.error("hh enrichment cron failed", error);
    return NextResponse.json({ error: "drain_failed" }, { status: 500 });
  }

  return NextResponse.json(totals);
}
