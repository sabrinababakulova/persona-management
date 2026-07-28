import { db } from "../src/server/db";
import {
  getTelegramUpdates,
  getTelegramWebhookInfo,
} from "../src/server/services/telegram";
import { requireTelegramResumeConfig } from "../src/server/services/telegram-resume/config";
import { enqueueTelegramResumeUpdate } from "../src/server/services/telegram-resume/ingestion";

async function main() {
  const config = requireTelegramResumeConfig();
  const webhook = await getTelegramWebhookInfo();
  if (webhook.url) {
    throw new Error(
      "getUpdates is unavailable while a webhook is configured. Pending " +
        "updates will be delivered to the webhook automatically.",
    );
  }

  const totals = {
    received: 0,
    enqueued: 0,
    ignored: 0,
    duplicates: 0,
    irrelevant: 0,
  };
  let offset: number | undefined;

  while (true) {
    const updates = await getTelegramUpdates({ offset, limit: 100 });
    if (updates.length === 0) {
      break;
    }

    for (const update of updates) {
      const result = await enqueueTelegramResumeUpdate({
        db,
        config,
        update,
      });
      totals.received += 1;
      if (result.outcome === "enqueued") totals.enqueued += 1;
      if (result.outcome === "ignored") totals.ignored += 1;
      if (result.outcome === "duplicate") totals.duplicates += 1;
      if (result.outcome === "irrelevant") totals.irrelevant += 1;
    }

    // The next call acknowledges this successfully persisted batch.
    offset = Math.max(...updates.map((update) => update.update_id)) + 1;
  }

  console.log(JSON.stringify({ queue: totals }, null, 2));

  if (process.argv.includes("--drain")) {
    const { drainTelegramResumeImports } = await import(
      "../src/server/services/telegram-resume/worker"
    );
    const processed = { claimed: 0, created: 0, retried: 0, failed: 0 };
    while (true) {
      const batch = await drainTelegramResumeImports({ db, batchSize: 1 });
      processed.claimed += batch.claimed;
      processed.created += batch.created;
      processed.retried += batch.retried;
      processed.failed += batch.failed;
      if (batch.claimed === 0) break;
    }
    console.log(JSON.stringify({ processed }, null, 2));
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
