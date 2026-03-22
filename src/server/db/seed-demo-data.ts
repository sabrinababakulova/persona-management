import { fileURLToPath } from "node:url";

import { sql } from "drizzle-orm";
import * as schema from "~/server/db/schema";
import { DEFAULT_COMPANY_ID, runSeedScript, type SeedDb } from "./seed-utils";

type LookupOption = { value: string; label: string };
type SeedRow = LookupOption & { sortOrder: number; isActive: boolean };
type DemoCandidate = typeof schema.candidates.$inferInsert & { id: string };
type DemoVacancy = typeof schema.vacancies.$inferInsert & { id: string };
type DemoRecentActivity = typeof schema.recentActivityLogs.$inferInsert & {
  id: string;
};

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

const DEMO_CANDIDATES: DemoCandidate[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    fullName: "Анна Каримова",
    city: "Ташкент",
    contacts: [
      { type: "telegram", value: "@anna_karimova" },
      { type: "phone", value: "+998901112233" },
      { type: "email", value: "anna.karimova@example.com" },
    ],
    source: "linkedin",
    salaryExpectation: 2800,
    salaryCurrency: "USD",
    currentPosition: "frontend_developer",
    skills: ["React", "TypeScript", "JavaScript", "Figma"],
    languages: [
      { name: "Русский", level: "C2" },
      { name: "Английский", level: "B2" },
    ],
    status: "screening",
    aiAnalysis:
      "Сильный frontend-кандидат с уверенным опытом в React и TypeScript. Хорошо подходит для продуктовой команды с акцентом на скорость поставки интерфейсов.",
    companyId: DEFAULT_COMPANY_ID,
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    fullName: "Илья Петров",
    city: "Самарканд",
    contacts: [
      { type: "telegram", value: "@ilya_backend" },
      { type: "phone", value: "+998907778899" },
    ],
    source: "hh.uz",
    salaryExpectation: 3200,
    salaryCurrency: "USD",
    currentPosition: "backend_developer",
    skills: ["Node.js", "TypeScript", "JavaScript", "Python"],
    languages: [
      { name: "Русский", level: "C2" },
      { name: "Английский", level: "B1" },
    ],
    status: "hired",
    aiAnalysis:
      "Backend-разработчик с опытом в Node.js и Python. Подходит для вакансий, где важны API, интеграции и стабильная серверная архитектура.",
    companyId: DEFAULT_COMPANY_ID,
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    fullName: "Диана Хасанова",
    city: "Ташкент",
    contacts: [
      { type: "telegram", value: "@diana_design" },
      { type: "email", value: "diana.hasanova@example.com" },
    ],
    source: "telegram",
    salaryExpectation: 2200,
    salaryCurrency: "USD",
    currentPosition: "product_designer",
    skills: ["Figma", "Adobe Photoshop", "Adobe Illustrator", "Креативность"],
    languages: [
      { name: "Русский", level: "C2" },
      { name: "Английский", level: "B2" },
      { name: "Узбекский", level: "B2" },
    ],
    status: "interview",
    aiAnalysis:
      "Дизайнер с выраженным продуктовым мышлением. Сильна в UI-концептах, прототипировании и совместной работе с разработкой.",
    companyId: DEFAULT_COMPANY_ID,
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    fullName: "Тимур Рахимов",
    city: "Бухара",
    contacts: [
      { type: "phone", value: "+998935551144" },
      { type: "email", value: "timur.rahimov@example.com" },
    ],
    source: "referral",
    salaryExpectation: 1800,
    salaryCurrency: "USD",
    currentPosition: "project_manager",
    skills: ["Управление проектами", "Аналитика", "Коммуникабельность"],
    languages: [
      { name: "Русский", level: "C1" },
      { name: "Узбекский", level: "C2" },
    ],
    status: "new",
    aiAnalysis:
      "Project manager с опытом координации небольших продуктовых команд. Подходит для роли с акцентом на процессы и коммуникацию.",
    companyId: DEFAULT_COMPANY_ID,
  },
  {
    id: "55555555-5555-4555-8555-555555555555",
    fullName: "Малика Саидова",
    city: "Ташкент",
    contacts: [
      { type: "telegram", value: "@malika_hr" },
      { type: "phone", value: "+998977771122" },
    ],
    source: "other",
    salaryExpectation: 15000000,
    salaryCurrency: "UZS",
    currentPosition: "hr_manager",
    skills: ["Коммуникабельность", "Аналитика"],
    languages: [
      { name: "Русский", level: "C2" },
      { name: "Английский", level: "B1" },
    ],
    status: "offer",
    aiAnalysis:
      "HR-специалист с опытом закрытия массовых и точечных вакансий. Сильна в интервьюировании и ведении кандидатов по воронке.",
    companyId: DEFAULT_COMPANY_ID,
  },
];

const DEMO_VACANCIES: DemoVacancy[] = [
  {
    id: "aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    title: "Senior Frontend Developer",
    level: "senior",
    status: "active",
    city: "Ташкент",
    responses: 18,
    workType: "hybrid",
    salaryExpectation: 3500,
    salaryCurrency: "USD",
    workScheduleStart: "10:00",
    workScheduleEnd: "19:00",
    comments: "Приоритет на опыт с React и продуктовой аналитикой.",
    tasks:
      "Разработка новых интерфейсов, участие в архитектурных решениях, взаимодействие с дизайнерами и backend-командой.",
    team: "Продуктовая команда из 7 человек, включая PM, QA и двух backend-разработчиков.",
    companyDescription:
      "B2B SaaS-платформа для автоматизации HR-процессов с активной фазой роста.",
    companyId: DEFAULT_COMPANY_ID,
  },
  {
    id: "aaaaaaa2-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
    title: "Product Designer",
    level: "middle",
    status: "active",
    city: "Удаленно",
    responses: 11,
    workType: "remote",
    salaryExpectation: 2400,
    salaryCurrency: "USD",
    workScheduleStart: "09:00",
    workScheduleEnd: "18:00",
    comments: "Нужен сильный UX и уверенная работа в Figma.",
    tasks:
      "Проектирование пользовательских сценариев, подготовка макетов, тестирование гипотез вместе с продакт-менеджером.",
    team: "Дизайн-команда из 3 человек, тесная связка с продуктом и разработкой.",
    companyDescription:
      "Команда строит HR-продукт для рынка Узбекистана и стран СНГ.",
    companyId: DEFAULT_COMPANY_ID,
  },
  {
    id: "aaaaaaa3-aaaa-4aaa-8aaa-aaaaaaaaaaa3",
    title: "HR Manager",
    level: "middle",
    status: "draft",
    city: "Ташкент",
    responses: 3,
    workType: "office",
    salaryExpectation: 14000000,
    salaryCurrency: "UZS",
    workScheduleStart: "09:00",
    workScheduleEnd: "18:00",
    comments: "Вакансия пока на согласовании бюджета.",
    tasks:
      "Полный цикл подбора, координация интервью, ведение базы кандидатов и аналитики по каналам.",
    team: "HR-команда из 2 рекрутеров и руководителя функции.",
    companyDescription:
      "Внутренняя рекрутинговая команда продуктовой компании.",
    companyId: DEFAULT_COMPANY_ID,
  },
  {
    id: "aaaaaaa4-aaaa-4aaa-8aaa-aaaaaaaaaaa4",
    title: "Backend Developer",
    level: "middle",
    status: "closed",
    city: "Самарканд",
    responses: 24,
    workType: "hybrid",
    salaryExpectation: 2800,
    salaryCurrency: "USD",
    workScheduleStart: "10:00",
    workScheduleEnd: "19:00",
    comments: "Позиция закрыта после выхода кандидата.",
    tasks:
      "Разработка API, интеграции с внешними сервисами, оптимизация производительности серверной части.",
    team: "Инженерная команда из 9 человек.",
    companyDescription:
      "Продуктовая разработка с высокой долей интеграций и автоматизации.",
    companyId: DEFAULT_COMPANY_ID,
  },
];

const toSeedRows = (options: LookupOption[]): SeedRow[] =>
  options.map((option, index) => ({
    ...option,
    sortOrder: index + 1,
    isActive: true,
  }));

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

async function seedLookups(db: SeedDb) {
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

  await db
    .insert(schema.companies)
    .values({
      id: DEFAULT_COMPANY_ID,
      name: "Default Company",
    })
    .onConflictDoNothing({ target: schema.companies.id });
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

function getRecentActivityRows() {
  return [
    {
      id: "90000000-0000-4000-8000-000000000001",
      entityType: "candidate",
      entityId: "55555555-5555-4555-8555-555555555555",
      actorUserId: null,
      actorName: "Демо система",
      action: "Подготовил(а) оффер кандидату",
      targetName: "Малика Саидова",
      targetStatus: "Оффер",
      createdAt: new Date(Date.now() - 1000 * 60 * 20),
    },
    {
      id: "90000000-0000-4000-8000-000000000002",
      entityType: "candidate",
      entityId: "33333333-3333-4333-8333-333333333333",
      actorUserId: null,
      actorName: "Демо система",
      action: "Перевел(а) кандидата на интервью",
      targetName: "Диана Хасанова",
      targetStatus: "Интервью",
      createdAt: new Date(Date.now() - 1000 * 60 * 90),
    },
    {
      id: "90000000-0000-4000-8000-000000000003",
      entityType: "vacancy",
      entityId: "aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
      actorUserId: null,
      actorName: "Демо система",
      action: "Создал(а) вакансию",
      targetName: "Senior Frontend Developer",
      targetStatus: "Активна",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 4),
    },
    {
      id: "90000000-0000-4000-8000-000000000004",
      entityType: "candidate",
      entityId: "22222222-2222-4222-8222-222222222222",
      actorUserId: null,
      actorName: "Демо система",
      action: "Закрыл(а) кандидата на найм",
      targetName: "Илья Петров",
      targetStatus: "Нанят",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 8),
    },
    {
      id: "90000000-0000-4000-8000-000000000005",
      entityType: "candidate",
      entityId: "44444444-4444-4444-8444-444444444444",
      actorUserId: null,
      actorName: "Демо система",
      action: "Добавил(а) нового кандидата",
      targetName: "Тимур Рахимов",
      targetStatus: "Новый",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 18),
    },
  ] satisfies DemoRecentActivity[];
}

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
    const { id, ...set } = vacancy;

    await db.insert(schema.vacancies).values(vacancy).onConflictDoUpdate({
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
