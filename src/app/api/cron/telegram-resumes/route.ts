import { NextResponse } from "next/server";

import { env } from "~/env";
import { db } from "~/server/db";
import { getCompanyFeatures } from "~/server/services/feature-flags";
import { drainTelegramResumeImports } from "~/server/services/telegram-resume";
import { getTelegramResumeConfig } from "~/server/services/telegram-resume/config";

export const runtime = "nodejs";

/**
 * Processes one queued Telegram resume per call. AI extraction and summary run
 * concurrently inside the worker; bounding the batch keeps scheduler requests
 * predictable while a once-per-minute cron steadily drains large backfills.
 */
export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${env.AUTH_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // The pipeline is single-company by env config, so a route-level flag
  // check is enough to pause processing without touching the worker.
  const config = getTelegramResumeConfig();
  if (config) {
    const features = await getCompanyFeatures(db, config.companyId);
    if (!features.canUseTelegramWarehouse) {
      return NextResponse.json({ processed: 0, skipped: "feature_disabled" });
    }
  }

  try {
    const result = await drainTelegramResumeImports({ db, batchSize: 1 });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Telegram resume worker cron failed", error);
    return NextResponse.json({ error: "drain_failed" }, { status: 500 });
  }
}
