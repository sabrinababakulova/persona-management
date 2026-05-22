import { NextResponse } from "next/server";

import { env } from "~/env";
import { db } from "~/server/db";
import { syncHhCandidateStatuses } from "~/server/services/hh";
import {
  listHhConnectedCompanyIds,
  resolveCompanyHhAccounts,
} from "~/server/services/hh-company-account";

/**
 * Reconciles candidate statuses with hh.uz (sync Layer 3) for every company
 * with a connected hh.uz account.
 *
 * Discovery only finds new negotiations, so a candidate rejected later on
 * hh.uz would otherwise never update. This route re-walks every negotiation
 * and rewrites the platform status from hh.uz. Authorized with the server
 * `AUTH_SECRET` as a bearer token.
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
    applicationsUpdated: 0,
    statusesApplied: 0,
  };

  try {
    const companyIds = await listHhConnectedCompanyIds(db);

    for (const companyId of companyIds) {
      try {
        const employers = await resolveCompanyHhAccounts(db, companyId);
        if (employers.length === 0) {
          continue;
        }
        const result = await syncHhCandidateStatuses({
          db,
          companyId,
          employers,
        });
        totals.companies += 1;
        totals.vacanciesProcessed += result.vacanciesProcessed;
        totals.applicationsUpdated += result.applicationsUpdated;
        totals.statusesApplied += result.statusesApplied;
      } catch (error) {
        // One bad company must not abort status sync for the rest.
        totals.companiesFailed += 1;
        console.error("hh status cron failed for company", {
          companyId,
          error,
        });
      }
    }
  } catch (error) {
    console.error("hh status cron failed", error);
    return NextResponse.json({ error: "status_sync_failed" }, { status: 500 });
  }

  return NextResponse.json(totals);
}
