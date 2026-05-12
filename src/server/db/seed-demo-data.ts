import { fileURLToPath } from "node:url";

import * as schema from "~/server/db/schema";
import { runSeedScript, type SeedDb } from "./seed-utils";
import { DEMO_CANDIDATES } from "./seeds/demo/demo-candidates";
import { DEMO_VACANCIES } from "./seeds/demo/demo-vacancies";
import { seedLookups } from "./seeds/demo/lookups";
import { getRecentActivityRows } from "./seeds/demo/recent-activities";

export async function seedDemoData(db: SeedDb) {
  await seedLookups(db);

  for (const candidate of DEMO_CANDIDATES) {
    const { id, ...set } = candidate;

    await db.insert(schema.candidates).values(candidate).onConflictDoUpdate({
      target: schema.candidates.id,
      set,
    });
  }
  console.log(`Seeded demo candidates: ${DEMO_CANDIDATES.length} rows`);

  for (const vacancy of DEMO_VACANCIES) {
    const vacancyWithParent = {
      ...vacancy,
      parentId: vacancy.parentId ?? vacancy.id,
    };
    const { id, ...set } = vacancyWithParent;

    await db
      .insert(schema.vacancies)
      .values(vacancyWithParent)
      .onConflictDoUpdate({
        target: schema.vacancies.id,
        set,
      });
  }
  console.log(`Seeded demo vacancies: ${DEMO_VACANCIES.length} rows`);

  const recentActivities = getRecentActivityRows();
  for (const activity of recentActivities) {
    const { id, ...set } = activity;

    await db
      .insert(schema.recentActivityLogs)
      .values(activity)
      .onConflictDoUpdate({
        target: schema.recentActivityLogs.id,
        set,
      });
  }
  console.log(`Seeded demo recent activities: ${recentActivities.length} rows`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    await runSeedScript("Demo data seeding", seedDemoData);
  } catch (error) {
    console.error("Demo data seeding failed.", error);
    process.exitCode = 1;
  }
}
