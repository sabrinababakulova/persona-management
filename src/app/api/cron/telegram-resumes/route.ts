import { NextResponse } from "next/server";

import { env } from "~/env";
import { db } from "~/server/db";
import { drainTelegramResumeImports } from "~/server/services/telegram-resume";

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

  // Per-company feature gating happens inside the worker's claim query:
  // jobs of unflagged companies stay pending and resume if re-enabled.
  try {
    const result = await drainTelegramResumeImports({ db, batchSize: 1 });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Telegram resume worker cron failed", error);
    return NextResponse.json({ error: "drain_failed" }, { status: 500 });
  }
}
