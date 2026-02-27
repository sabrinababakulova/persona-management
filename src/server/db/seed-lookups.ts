import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "~/server/db/schema";
import { DEFAULT_CANDIDATE_LOOKUPS } from "~/shared/candidate-lookups";
import { DEFAULT_VACANCY_LOOKUPS } from "~/shared/vacancy-lookups";

type LookupOption = { value: string; label: string };
type SeedRow = LookupOption & { sortOrder: number; isActive: boolean };

const toSeedRows = (options: LookupOption[]): SeedRow[] =>
  options.map((option, index) => ({
    ...option,
    sortOrder: index + 1,
    isActive: true,
  }));

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to run lookup seeding.");
}

const client = postgres(databaseUrl);
const db = drizzle(client, { schema });

async function seedTable(
  tableName: string,
  options: LookupOption[],
  upsert: (row: SeedRow) => Promise<unknown>,
) {
  const rows = toSeedRows(options);

  for (const row of rows) {
    await upsert(row);
  }

  console.log(`Seeded ${tableName}: ${rows.length} rows`);
}

async function main() {
  await seedTable(
    "persona-management_candidate_contact_type",
    DEFAULT_CANDIDATE_LOOKUPS.contactTypes,
    async (row) => {
      await db
        .insert(schema.candidateContactTypes)
        .values(row)
        .onConflictDoUpdate({
          target: schema.candidateContactTypes.value,
          set: {
            label: row.label,
            sortOrder: row.sortOrder,
            isActive: row.isActive,
          },
        });
    },
  );

  await seedTable(
    "persona-management_candidate_language",
    DEFAULT_CANDIDATE_LOOKUPS.languages,
    async (row) => {
      await db
        .insert(schema.candidateLanguages)
        .values(row)
        .onConflictDoUpdate({
          target: schema.candidateLanguages.value,
          set: {
            label: row.label,
            sortOrder: row.sortOrder,
            isActive: row.isActive,
          },
        });
    },
  );

  await seedTable(
    "persona-management_candidate_language_level",
    DEFAULT_CANDIDATE_LOOKUPS.languageLevels,
    async (row) => {
      await db
        .insert(schema.candidateLanguageLevels)
        .values(row)
        .onConflictDoUpdate({
          target: schema.candidateLanguageLevels.value,
          set: {
            label: row.label,
            sortOrder: row.sortOrder,
            isActive: row.isActive,
          },
        });
    },
  );

  await seedTable(
    "persona-management_candidate_position",
    DEFAULT_CANDIDATE_LOOKUPS.positions,
    async (row) => {
      await db
        .insert(schema.candidatePositions)
        .values(row)
        .onConflictDoUpdate({
          target: schema.candidatePositions.value,
          set: {
            label: row.label,
            sortOrder: row.sortOrder,
            isActive: row.isActive,
          },
        });
    },
  );

  await seedTable(
    "persona-management_candidate_skill",
    DEFAULT_CANDIDATE_LOOKUPS.skills,
    async (row) => {
      await db
        .insert(schema.candidateSkills)
        .values(row)
        .onConflictDoUpdate({
          target: schema.candidateSkills.value,
          set: {
            label: row.label,
            sortOrder: row.sortOrder,
            isActive: row.isActive,
          },
        });
    },
  );

  await seedTable(
    "persona-management_candidate_source",
    DEFAULT_CANDIDATE_LOOKUPS.sources,
    async (row) => {
      await db
        .insert(schema.candidateSources)
        .values(row)
        .onConflictDoUpdate({
          target: schema.candidateSources.value,
          set: {
            label: row.label,
            sortOrder: row.sortOrder,
            isActive: row.isActive,
          },
        });
    },
  );

  await seedTable(
    "persona-management_candidate_status_option",
    DEFAULT_CANDIDATE_LOOKUPS.statusOptions,
    async (row) => {
      await db
        .insert(schema.candidateStatusOptions)
        .values(row)
        .onConflictDoUpdate({
          target: schema.candidateStatusOptions.value,
          set: {
            label: row.label,
            sortOrder: row.sortOrder,
            isActive: row.isActive,
          },
        });
    },
  );

  await seedTable(
    "persona-management_vacancy_level_option",
    DEFAULT_VACANCY_LOOKUPS.levels,
    async (row) => {
      await db
        .insert(schema.vacancyLevels)
        .values(row)
        .onConflictDoUpdate({
          target: schema.vacancyLevels.value,
          set: {
            label: row.label,
            sortOrder: row.sortOrder,
            isActive: row.isActive,
          },
        });
    },
  );

  await seedTable(
    "persona-management_vacancy_status_option",
    DEFAULT_VACANCY_LOOKUPS.statusOptions,
    async (row) => {
      await db
        .insert(schema.vacancyStatusOptions)
        .values(row)
        .onConflictDoUpdate({
          target: schema.vacancyStatusOptions.value,
          set: {
            label: row.label,
            sortOrder: row.sortOrder,
            isActive: row.isActive,
          },
        });
    },
  );

  await seedTable(
    "persona-management_vacancy_work_type_option",
    DEFAULT_VACANCY_LOOKUPS.workTypes,
    async (row) => {
      await db
        .insert(schema.vacancyWorkTypes)
        .values(row)
        .onConflictDoUpdate({
          target: schema.vacancyWorkTypes.value,
          set: {
            label: row.label,
            sortOrder: row.sortOrder,
            isActive: row.isActive,
          },
        });
    },
  );
}

try {
  await main();
  console.log("Lookup seeding completed successfully.");
} catch (error) {
  console.error("Lookup seeding failed.", error);
  process.exitCode = 1;
} finally {
  await client.end();
}
