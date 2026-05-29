import { NextResponse } from "next/server";

import { env } from "~/env";
import { db } from "~/server/db";
import { discoverHhCandidates } from "~/server/services/hh";
import {
  listHhConnectedCompanyIds,
  resolveCompanyHhAccounts,
} from "~/server/services/hh-company-account";

/**
 * Runs hh.uz candidate discovery (sync Layer 1) for every company with a
 * connected hh.uz account.
 *
 * Intended to be hit by a scheduler so the funnel keeps picking up new
 * applicants without the user reconnecting. Discovery is bounded by a
 * per-vacancy watermark, so a run with no new applicants is cheap. Authorized
 * with the server `AUTH_SECRET` as a bearer token.
 */
export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");
  if (authorization !== `Bearer ${env.AUTH_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const totals = {
    companies: 0,
    companiesFailed: 0,
    vacanciesProcessed: 0,
    vacanciesFailed: 0,
    newCandidates: 0,
    newApplications: 0,
    jobsEnqueued: 0,
  };

  try {
    const companyIds = await listHhConnectedCompanyIds(db);

    for (const companyId of companyIds) {
      try {
        const employers = await resolveCompanyHhAccounts(db, companyId);
        if (employers.length === 0) {
          continue;
        }
        const result = await discoverHhCandidates({
          db,
          companyId,
          employers,
        });
        totals.companies += 1;
        totals.vacanciesProcessed += result.vacanciesProcessed;
        totals.vacanciesFailed += result.vacanciesFailed;
        totals.newCandidates += result.newCandidates;
        totals.newApplications += result.newApplications;
        totals.jobsEnqueued += result.jobsEnqueued;
      } catch (error) {
        // One bad company must not abort discovery for the rest.
        totals.companiesFailed += 1;
        console.error("hh discovery cron failed for company", {
          companyId,
          error,
        });
      }
    }
  } catch (error) {
    console.error("hh discovery cron failed", error);
    return NextResponse.json({ error: "discovery_failed" }, { status: 500 });
  }

  return NextResponse.json(totals);
}
