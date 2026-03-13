import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "~/server/db/schema";

type LookupOption = { value: string; label: string };
type SeedRow = LookupOption & { sortOrder: number; isActive: boolean };

const CANDIDATE_CONTACT_TYPES: LookupOption[] = [
  { value: "telegram", label: "Telegram" },
  { value: "phone", label: "Телефон" },
  { value: "email", label: "Email" },
  { value: "whatsapp", label: "WhatsApp" },
];

const CANDIDATE_SOURCES: LookupOption[] = [
  { value: "hh.uz", label: "hh.uz" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "telegram", label: "Telegram" },
  { value: "referral", label: "Реферал" },
  { value: "other", label: "Другое" },
];

const CANDIDATE_POSITIONS: LookupOption[] = [
  { value: "frontend_developer", label: "Frontend Developer" },
  { value: "backend_developer", label: "Backend Developer" },
  { value: "fullstack_developer", label: "Fullstack Developer" },
  { value: "product_designer", label: "Product Designer" },
  { value: "graphic_designer", label: "Graphic Designer" },
  { value: "project_manager", label: "Project Manager" },
  { value: "hr_manager", label: "HR Manager" },
  { value: "marketing_manager", label: "Marketing Manager" },
];

const CANDIDATE_SKILLS: LookupOption[] = [
  { value: "React", label: "React" },
  { value: "TypeScript", label: "TypeScript" },
  { value: "JavaScript", label: "JavaScript" },
  { value: "Node.js", label: "Node.js" },
  { value: "Python", label: "Python" },
  { value: "Figma", label: "Figma" },
  { value: "Adobe Photoshop", label: "Adobe Photoshop" },
  { value: "Adobe Illustrator", label: "Adobe Illustrator" },
  { value: "Коммуникабельность", label: "Коммуникабельность" },
  { value: "Креативность", label: "Креативность" },
  { value: "Управление проектами", label: "Управление проектами" },
  { value: "Аналитика", label: "Аналитика" },
];

const CANDIDATE_LANGUAGES: LookupOption[] = [
  { value: "russian", label: "Русский" },
  { value: "uzbek", label: "Узбекский" },
  { value: "english", label: "Английский" },
  { value: "german", label: "Немецкий" },
  { value: "french", label: "Французский" },
  { value: "spanish", label: "Испанский" },
  { value: "korean", label: "Корейский" },
  { value: "chinese", label: "Китайский" },
];

const CANDIDATE_LANGUAGE_LEVELS: LookupOption[] = [
  { value: "A1", label: "A1 - Начальный" },
  { value: "A2", label: "A2 - Элементарный" },
  { value: "B1", label: "B1 - Средний" },
  { value: "B2", label: "B2 - Выше среднего" },
  { value: "C1", label: "C1 - Продвинутый" },
  { value: "C2", label: "C2 - Владение в совершенстве" },
];

const CANDIDATE_STATUS_OPTIONS: LookupOption[] = [
  { value: "new", label: "Новый" },
  { value: "screening", label: "Скрининг" },
  { value: "interview", label: "Интервью" },
  { value: "offer", label: "Оффер" },
  { value: "hired", label: "Нанят" },
  { value: "rejected", label: "Отклонен" },
];

const VACANCY_LEVELS: LookupOption[] = [
  { value: "intern", label: "Стажер" },
  { value: "junior", label: "Джуниор" },
  { value: "middle", label: "Мидл" },
  { value: "senior", label: "Сеньор" },
  { value: "lead", label: "Лид" },
];

const VACANCY_WORK_TYPES: LookupOption[] = [
  { value: "office", label: "Офис" },
  { value: "remote", label: "Удаленно" },
  { value: "hybrid", label: "Гибрид" },
  { value: "part-time", label: "Частичная занятость" },
];

const VACANCY_STATUS_OPTIONS: LookupOption[] = [
  { value: "active", label: "Активна" },
  { value: "draft", label: "Черновик" },
  { value: "paused", label: "Приостановлена" },
  { value: "closed", label: "Закрыта" },
  { value: "archive", label: "Архив" },
];

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
