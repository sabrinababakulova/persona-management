import { sql } from "drizzle-orm";
import { ensureCompanyTelegramResumeWarehouse } from "~/server/company/telegram-resume-warehouse";
import * as schema from "~/server/db/schema";
import { DEFAULT_COMPANY_ID } from "~/shared/default-company";
import type { SeedDb } from "../../seed-utils";
import {
  CANDIDATE_CONTACT_TYPES,
  CANDIDATE_LANGUAGE_LEVELS,
  CANDIDATE_LANGUAGES,
  CANDIDATE_POSITIONS,
  CANDIDATE_SKILLS,
  CANDIDATE_SOURCES,
  CANDIDATE_STATUS_OPTIONS,
  VACANCY_LEVELS,
  VACANCY_SOURCE_OPTIONS,
  VACANCY_STATUS_OPTIONS,
  VACANCY_WORK_TYPES,
} from "./lookup-options";
import type { LookupOption, SeedRow } from "./types";

export const toSeedRows = (options: LookupOption[]): SeedRow[] =>
  options.map((option, index) => ({
    ...option,
    sortOrder: index + 1,
    isActive: true,
  }));

export async function seedTable(
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

export async function seedLookups(db: SeedDb) {
  await seedTable(
    "candidate_contact_type",
    CANDIDATE_CONTACT_TYPES,
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

  await seedTable("candidate_language", CANDIDATE_LANGUAGES, async (row) => {
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
  });

  await seedTable(
    "candidate_language_level",
    CANDIDATE_LANGUAGE_LEVELS,
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

  await seedTable("candidate_position", CANDIDATE_POSITIONS, async (row) => {
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
  });

  await seedTable("candidate_skill", CANDIDATE_SKILLS, async (row) => {
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
  });

  await seedTable("candidate_source", CANDIDATE_SOURCES, async (row) => {
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
  });

  await seedTable(
    "candidate_status_option",
    CANDIDATE_STATUS_OPTIONS,
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

  await seedTable("vacancy_level_option", VACANCY_LEVELS, async (row) => {
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
  });

  await seedTable(
    "vacancy_status_option",
    VACANCY_STATUS_OPTIONS,
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
    "vacancy_source_option",
    VACANCY_SOURCE_OPTIONS,
    async (row) => {
      await db
        .insert(schema.vacancySources)
        .values(row)
        .onConflictDoUpdate({
          target: schema.vacancySources.value,
          set: {
            label: row.label,
            sortOrder: row.sortOrder,
            isActive: row.isActive,
          },
        });
    },
  );

  await seedTable(
    "vacancy_work_type_option",
    VACANCY_WORK_TYPES,
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

  await db
    .insert(schema.companies)
    .values({
      id: DEFAULT_COMPANY_ID,
      name: "Default Company",
    })
    .onConflictDoNothing({ target: schema.companies.id });
  await ensureCompanyTelegramResumeWarehouse(db, DEFAULT_COMPANY_ID);
  console.log("Seeded default company");

  await db
    .update(schema.users)
    .set({ companyId: DEFAULT_COMPANY_ID })
    .where(sql`${schema.users.companyId} IS NULL`);
  console.log("Assigned default company to users without one");

  await db
    .update(schema.vacancies)
    .set({ companyId: DEFAULT_COMPANY_ID })
    .where(sql`${schema.vacancies.companyId} IS NULL`);
  console.log("Assigned default company to vacancies without one");

  await db
    .update(schema.candidates)
    .set({ companyId: DEFAULT_COMPANY_ID })
    .where(sql`${schema.candidates.companyId} IS NULL`);
  console.log("Assigned default company to candidates without one");
}
