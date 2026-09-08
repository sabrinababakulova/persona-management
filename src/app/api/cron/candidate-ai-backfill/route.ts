import { NextResponse } from "next/server";

import { db } from "~/server/db";
import { isAuthorizedCronRequest } from "~/server/http/cron-auth";
import { backfillCandidateAiMetadata } from "~/server/resume/backfill-candidate-ai-metadata";

export const runtime = "nodejs";

/**
 * Fills missing AI analysis, ru/en/uz translations, and search tags from the
 * stored candidate profile. The endpoint is bounded and bearer-authenticated
 * for safe once-per-minute scheduling.
 */
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await backfillCandidateAiMetadata({ db });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Candidate AI metadata cron failed", error);
    return NextResponse.json({ error: "backfill_failed" }, { status: 500 });
  }
}
