import { db } from "../src/server/db";
import { drainTelegramResumeImports } from "../src/server/services/telegram-resume";

async function main() {
  const once = process.argv.includes("--once");
  const totals = { claimed: 0, created: 0, retried: 0, failed: 0 };

  while (true) {
    const batch = await drainTelegramResumeImports({ db, batchSize: 1 });
    totals.claimed += batch.claimed;
    totals.created += batch.created;
    totals.retried += batch.retried;
    totals.failed += batch.failed;

    console.log(JSON.stringify(batch));
    if (once || batch.claimed === 0) break;
  }

  console.log(JSON.stringify({ totals }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
