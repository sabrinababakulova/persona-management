import { fileURLToPath } from "node:url";

import { sql } from "drizzle-orm";
import * as schema from "~/server/db/schema";
import { DEFAULT_COMPANY_ID } from "~/shared/default-company";
import { runSeedScript, type SeedDb } from "./seed-utils";

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

const VACANCY_SOURCE_OPTIONS: LookupOption[] = [
  { value: "local", label: "Локальная" },
  { value: "hh.uz", label: "hh.uz" },
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
    currentPosition: "Tech Solutions Inc. | Frontend Developer",
    experience: "5+ лет",
    matchScore: 92,
    skills: ["React", "TypeScript", "JavaScript", "Figma"],
    languages: [
      { name: "Русский", level: "C2" },
      { name: "Английский", level: "B2" },
    ],
    tags: ["English C1", "Senior", "Возраст 25+"],
    workExperience: [
      {
        company: "Tech Solutions Inc.",
        position: "Network Engineer",
        period: "Январь 2024 - Сейчас",
        description: [
          "Мы занимаемся разработкой и поддержкой веб-приложений, активно участвуем в командных проектах.",
          "Тщательная отладка кода, чтобы обеспечить высокое качество и надежность программного обеспечения.",
        ],
      },
      {
        company: "Globex International",
        position: "Senior Systems Architect",
        period: "Февраль 2022 - Январь 2023",
        description: [
          "Участвую в проектировании и развертывании облачных инфраструктур, обеспечивая их масштабируемость и безопасность.",
          "Занимаюсь автоматизацией процессов разработки и внедрения, используя современные инструменты и практики DevOps.",
        ],
      },
    ],
    education: [
      {
        institution: "Inha University in Tashkent",
        gpa: "GPA 4.5",
        period: "Сентябрь 2016 - Июнь 2020",
      },
      {
        institution: "Frontend Masters",
        gpa: "Сертификат",
        period: "Март 2023 - Июнь 2023",
      },
    ],
    resumeFileName: "anna-karimova-cv.pdf",
    resumeFileSize: "12MB",
    notes: [
      {
        id: "note-anna-1",
        content:
          "Уверенно отвечает на вопросы по React-архитектуре и хорошо объясняет решения по типизации.",
        author: "Сабрина Бабакулова",
        createdAt: "2026-04-08T10:00:00.000Z",
      },
      {
        id: "note-anna-2",
        content:
          "Рекомендуется на следующий технический этап для продуктовой frontend-команды.",
        author: "Демо система",
        createdAt: "2026-04-09T14:30:00.000Z",
      },
    ],
    activities: [
      {
        id: "activity-anna-1",
        userName: "Сабрина Бабакулова",
        userAvatar: "",
        action: "Перевел(а) кандидата",
        targetName: "Анна Каримова",
        targetStatus: "Скрининг",
        timeAgo: "2 ч назад",
      },
      {
        id: "activity-anna-2",
        userName: "Демо система",
        userAvatar: "",
        action: "Обновил(а) AI-анализ",
        targetName: "Анна Каримова",
        targetStatus: "Готово",
        timeAgo: "Вчера",
      },
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
    currentPosition: "Apex Banking Systems | Backend Developer",
    experience: "6+ лет",
    matchScore: 88,
    skills: ["Node.js", "TypeScript", "JavaScript", "Python"],
    languages: [
      { name: "Русский", level: "C2" },
      { name: "Английский", level: "B1" },
    ],
    tags: ["Node.js", "API", "PostgreSQL"],
    workExperience: [
      {
        company: "Apex Banking Systems",
        position: "Backend Developer",
        period: "Май 2022 - Сейчас",
        description: [
          "Разрабатывает внутренние API и интеграции для финансовых сервисов с акцентом на надежность.",
          "Оптимизировал производительность сервисов и сократил среднее время ответа ключевых эндпоинтов.",
        ],
      },
      {
        company: "Data River",
        position: "Python Engineer",
        period: "Июнь 2020 - Апрель 2022",
        description: [
          "Поддерживал ETL-пайплайны и сервисы обработки данных для аналитической платформы.",
          "Внедрил автоматизированный мониторинг фоновых задач и алерты для команды поддержки.",
        ],
      },
    ],
    education: [
      {
        institution: "ТУИТ",
        gpa: "GPA 4.3",
        period: "Сентябрь 2014 - Июнь 2018",
      },
      {
        institution: "Yandex Practicum",
        gpa: "Backend Track",
        period: "Январь 2021 - Август 2021",
      },
    ],
    resumeFileName: "ilya-petrov-backend.pdf",
    resumeFileSize: "9MB",
    notes: [
      {
        id: "note-ilya-1",
        content:
          "Сильный по серверной архитектуре, особенно в интеграциях и проектировании REST API.",
        author: "Демо система",
        createdAt: "2026-04-07T09:15:00.000Z",
      },
      {
        id: "note-ilya-2",
        content:
          "Есть релевантный опыт для high-load сценариев, стоит обсудить лидерские ожидания.",
        author: "Алина HR",
        createdAt: "2026-04-09T11:45:00.000Z",
      },
    ],
    activities: [
      {
        id: "activity-ilya-1",
        userName: "Алина HR",
        userAvatar: "",
        action: "Закрыл(а) кандидата на найм",
        targetName: "Илья Петров",
        targetStatus: "Нанят",
        timeAgo: "Только что",
      },
      {
        id: "activity-ilya-2",
        userName: "Демо система",
        userAvatar: "",
        action: "Добавил(а) комментарий",
        targetName: "Илья Петров",
        targetStatus: "Финальное интервью",
        timeAgo: "3 ч назад",
      },
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
    currentPosition: "Design Orbit | Product Designer",
    experience: "4+ года",
    matchScore: 84,
    skills: ["Figma", "Adobe Photoshop", "Adobe Illustrator", "Креативность"],
    languages: [
      { name: "Русский", level: "C2" },
      { name: "Английский", level: "B2" },
      { name: "Узбекский", level: "B2" },
    ],
    tags: ["Figma", "UX", "Research"],
    workExperience: [
      {
        company: "Design Orbit",
        position: "Product Designer",
        period: "Апрель 2023 - Сейчас",
        description: [
          "Проектирует интерфейсы для внутренних HR-инструментов и тесно работает с PM и разработкой.",
          "Проводит UX-исследования и защищает дизайн-решения на продуктовых ревью.",
        ],
      },
      {
        company: "Pixel Lab",
        position: "Graphic Designer",
        period: "Январь 2021 - Март 2023",
        description: [
          "Создавала брендовые и маркетинговые материалы для digital-кампаний.",
          "Собирала интерактивные прототипы и передавала макеты в разработку.",
        ],
      },
    ],
    education: [
      {
        institution: "Westminster International University in Tashkent",
        gpa: "GPA 4.4",
        period: "Сентябрь 2017 - Июнь 2021",
      },
      {
        institution: "Google UX Design Certificate",
        gpa: "Сертификат",
        period: "Май 2022 - Октябрь 2022",
      },
    ],
    resumeFileName: "diana-khasanova-portfolio.pdf",
    resumeFileSize: "11MB",
    notes: [
      {
        id: "note-diana-1",
        content:
          "Есть сильные кейсы по мобильным и веб-продуктам, особенно в сценариях онбординга.",
        author: "Сабрина Бабакулова",
        createdAt: "2026-04-08T13:00:00.000Z",
      },
      {
        id: "note-diana-2",
        content:
          "На интервью хорошо аргументировала решения и уверенно говорит про дизайн-системы.",
        author: "Демо система",
        createdAt: "2026-04-10T08:40:00.000Z",
      },
    ],
    activities: [
      {
        id: "activity-diana-1",
        userName: "Сабрина Бабакулова",
        userAvatar: "",
        action: "Перевел(а) кандидата",
        targetName: "Диана Хасанова",
        targetStatus: "Интервью",
        timeAgo: "1 ч назад",
      },
      {
        id: "activity-diana-2",
        userName: "Демо система",
        userAvatar: "",
        action: "Сохранил(а) заметку",
        targetName: "Диана Хасанова",
        targetStatus: "Портфолио reviewed",
        timeAgo: "Сегодня",
      },
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
    currentPosition: "Ops Bridge | Project Manager",
    experience: "3+ года",
    matchScore: 79,
    skills: ["Управление проектами", "Аналитика", "Коммуникабельность"],
    languages: [
      { name: "Русский", level: "C1" },
      { name: "Узбекский", level: "C2" },
    ],
    tags: ["Scrum", "Delivery", "Stakeholders"],
    workExperience: [
      {
        company: "Ops Bridge",
        position: "Project Manager",
        period: "Август 2023 - Сейчас",
        description: [
          "Ведет delivery нескольких внутренних инициатив и синхронизирует команды разработки, дизайна и бизнеса.",
          "Отслеживает сроки, риски и загрузку команды, готовит регулярные статусы для руководства.",
        ],
      },
      {
        company: "Regional Telecom",
        position: "Coordinator",
        period: "Февраль 2021 - Июль 2023",
        description: [
          "Координировал запуск сервисных задач между региональными офисами и центральной командой.",
          "Помогал стандартизировать процессы постановки задач и отчетности.",
        ],
      },
    ],
    education: [
      {
        institution: "Самаркандский государственный университет",
        gpa: "GPA 4.1",
        period: "Сентябрь 2015 - Июнь 2019",
      },
      {
        institution: "PMI Fundamentals",
        gpa: "Сертификат",
        period: "Февраль 2024 - Апрель 2024",
      },
    ],
    resumeFileName: "timur-rakhimov-pm.pdf",
    resumeFileSize: "8MB",
    notes: [
      {
        id: "note-timur-1",
        content:
          "Подходит на координационные роли, особенно там, где важна дисциплина по процессам и коммуникации.",
        author: "Алина HR",
        createdAt: "2026-04-06T15:00:00.000Z",
      },
      {
        id: "note-timur-2",
        content:
          "Нужно дополнительно проверить английский для международных созвонов.",
        author: "Демо система",
        createdAt: "2026-04-10T12:10:00.000Z",
      },
    ],
    activities: [
      {
        id: "activity-timur-1",
        userName: "Алина HR",
        userAvatar: "",
        action: "Добавил(а) нового кандидата",
        targetName: "Тимур Рахимов",
        targetStatus: "Новый",
        timeAgo: "4 ч назад",
      },
      {
        id: "activity-timur-2",
        userName: "Демо система",
        userAvatar: "",
        action: "Подготовил(а) профиль",
        targetName: "Тимур Рахимов",
        targetStatus: "К первичному звонку",
        timeAgo: "Вчера",
      },
    ],
    status: "new",
    aiAnalysis:
      "Project manager с опытом координации небольших продуктовых команд. Подходит для роли с акцентом на процессы и коммуникацию.",
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
  {
    id: "aaaaaaa5-aaaa-4aaa-8aaa-aaaaaaaaaaa5",
    title: "Middle Fullstack Developer",
    level: "middle",
    status: "active",
    city: "Ташкент",
    responses: 16,
    workType: "hybrid",
    salaryExpectation: 3000,
    salaryCurrency: "USD",
    workScheduleStart: "10:00",
    workScheduleEnd: "19:00",
    comments: "Нужен уверенный опыт с React и Node.js.",
    tasks:
      "Разработка фич на frontend и backend, участие в продуктовых созвонах и ревью решений.",
    team: "Кросс-функциональная команда из 6 человек.",
    companyDescription:
      "HR-tech продукт, который масштабируется на несколько рынков.",
    companyId: DEFAULT_COMPANY_ID,
  },
  {
    id: "aaaaaaa6-aaaa-4aaa-8aaa-aaaaaaaaaaa6",
    title: "Junior Recruiter",
    level: "junior",
    status: "active",
    city: "Ташкент",
    responses: 9,
    workType: "office",
    salaryExpectation: 9000000,
    salaryCurrency: "UZS",
    workScheduleStart: "09:00",
    workScheduleEnd: "18:00",
    comments: "Рассматриваем кандидатов с базовым опытом подбора.",
    tasks:
      "Поиск кандидатов, первичный контакт, координация интервью и ведение статусов.",
    team: "HR-функция из 4 человек.",
    companyDescription: "Внутренняя команда подбора для продуктового бизнеса.",
    companyId: DEFAULT_COMPANY_ID,
  },
  {
    id: "aaaaaaa7-aaaa-4aaa-8aaa-aaaaaaaaaaa7",
    title: "Graphic Designer",
    level: "middle",
    status: "paused",
    city: "Удаленно",
    responses: 7,
    workType: "remote",
    salaryExpectation: 1800,
    salaryCurrency: "USD",
    workScheduleStart: "10:00",
    workScheduleEnd: "19:00",
    comments: "Поиск приостановлен до финализации задач бренда.",
    tasks:
      "Подготовка визуалов для маркетинга, соцсетей, сайта и рекламных кампаний.",
    team: "Маркетинг и продукт в тесной связке с дизайнером.",
    companyDescription: "Команда строит узнаваемый бренд в сегменте HR SaaS.",
    companyId: DEFAULT_COMPANY_ID,
  },
  {
    id: "aaaaaaa8-aaaa-4aaa-8aaa-aaaaaaaaaaa8",
    title: "Project Manager",
    level: "middle",
    status: "active",
    city: "Самарканд",
    responses: 13,
    workType: "hybrid",
    salaryExpectation: 2300,
    salaryCurrency: "USD",
    workScheduleStart: "09:00",
    workScheduleEnd: "18:00",
    comments: "Нужен опыт работы с digital или продуктовой командой.",
    tasks:
      "Планирование спринтов, контроль сроков, фасилитация встреч и синхронизация команд.",
    team: "Команда из PM, дизайнеров, QA и разработчиков.",
    companyDescription: "Продуктовая компания с быстрыми релизными циклами.",
    companyId: DEFAULT_COMPANY_ID,
  },
  {
    id: "aaaaaaa9-aaaa-4aaa-8aaa-aaaaaaaaaaa9",
    title: "Marketing Manager",
    level: "middle",
    status: "active",
    city: "Ташкент",
    responses: 21,
    workType: "office",
    salaryExpectation: 2000,
    salaryCurrency: "USD",
    workScheduleStart: "09:00",
    workScheduleEnd: "18:00",
    comments: "Приоритет на performance и запуск новых каналов.",
    tasks:
      "Запуск кампаний, аналитика CAC и CPL, работа с контентом и лидогенерацией.",
    team: "Маркетинг-команда из 5 человек.",
    companyDescription: "B2B компания с фокусом на рост входящего спроса.",
    companyId: DEFAULT_COMPANY_ID,
  },
  {
    id: "aaaaaa10-aaaa-4aaa-8aaa-aaaaaaaaaa10",
    title: "Senior Backend Engineer",
    level: "senior",
    status: "active",
    city: "Удаленно",
    responses: 19,
    workType: "remote",
    salaryExpectation: 4200,
    salaryCurrency: "USD",
    workScheduleStart: "10:00",
    workScheduleEnd: "19:00",
    comments: "Нужен опыт высоконагруженных API и интеграций.",
    tasks:
      "Проектирование сервисов, ревью архитектуры, оптимизация производительности и надежности.",
    team: "Backend-ядро платформы из 4 инженеров.",
    companyDescription:
      "Продукт с активным ростом клиентской базы и требований к стабильности.",
    companyId: DEFAULT_COMPANY_ID,
  },
  {
    id: "aaaaaa11-aaaa-4aaa-8aaa-aaaaaaaaaa11",
    title: "Talent Sourcer",
    level: "junior",
    status: "draft",
    city: "Ташкент",
    responses: 2,
    workType: "office",
    salaryExpectation: 8000000,
    salaryCurrency: "UZS",
    workScheduleStart: "09:00",
    workScheduleEnd: "18:00",
    comments: "Роль в подготовке к расширению HR-команды.",
    tasks:
      "Поиск кандидатов, оформление short-list, обновление базы и коммуникация с рекрутерами.",
    team: "Talent Acquisition команда.",
    companyDescription:
      "Внутренний подбор для быстро растущей продуктовой компании.",
    companyId: DEFAULT_COMPANY_ID,
  },
  {
    id: "aaaaaa12-aaaa-4aaa-8aaa-aaaaaaaaaa12",
    title: "UX Researcher",
    level: "middle",
    status: "paused",
    city: "Удаленно",
    responses: 5,
    workType: "remote",
    salaryExpectation: 2200,
    salaryCurrency: "USD",
    workScheduleStart: "10:00",
    workScheduleEnd: "19:00",
    comments: "Ожидаем финального утверждения бюджета.",
    tasks:
      "Проведение интервью, качественные и количественные исследования, синтез инсайтов для продукта.",
    team: "Продукт и дизайн.",
    companyDescription:
      "Команда улучшает пользовательский опыт в нескольких ключевых воронках продукта.",
    companyId: DEFAULT_COMPANY_ID,
  },
  {
    id: "aaaaaa13-aaaa-4aaa-8aaa-aaaaaaaaaa13",
    title: "Frontend Team Lead",
    level: "lead",
    status: "active",
    city: "Ташкент",
    responses: 14,
    workType: "hybrid",
    salaryExpectation: 4800,
    salaryCurrency: "USD",
    workScheduleStart: "10:00",
    workScheduleEnd: "19:00",
    comments: "Нужен сильный engineering leadership и hands-on опыт.",
    tasks:
      "Развитие frontend-команды, архитектурные решения, менторинг и участие в критичных задачах.",
    team: "Frontend-направление из 5 разработчиков.",
    companyDescription:
      "Продуктовая разработка с высокими требованиями к качеству интерфейсов.",
    companyId: DEFAULT_COMPANY_ID,
  },
  {
    id: "aaaaaa14-aaaa-4aaa-8aaa-aaaaaaaaaa14",
    title: "QA Engineer",
    level: "middle",
    status: "closed",
    city: "Ташкент",
    responses: 12,
    workType: "office",
    salaryExpectation: 1700,
    salaryCurrency: "USD",
    workScheduleStart: "09:00",
    workScheduleEnd: "18:00",
    comments: "Позиция закрыта внутренней рекомендацией.",
    tasks:
      "Функциональное тестирование, регресс, написание тест-кейсов и участие в релизных проверках.",
    team: "QA-функция из 3 человек.",
    companyDescription:
      "Команда поддерживает стабильный цикл релизов и контроль качества.",
    companyId: DEFAULT_COMPANY_ID,
  },
  {
    id: "aaaaaa15-aaaa-4aaa-8aaa-aaaaaaaaaa15",
    title: "Office Manager",
    level: "junior",
    status: "archive",
    city: "Ташкент",
    responses: 8,
    workType: "office",
    salaryExpectation: 7000000,
    salaryCurrency: "UZS",
    workScheduleStart: "09:00",
    workScheduleEnd: "18:00",
    comments: "Вакансия в архиве после реорганизации офиса.",
    tasks:
      "Поддержка офиса, координация поставщиков, организация командных мероприятий и документооборот.",
    team: "Административная поддержка офиса.",
    companyDescription:
      "Компания с гибридным форматом работы и небольшим офисом в Ташкенте.",
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
      entityId: "11111111-1111-4111-8111-111111111111",
      companyId: DEFAULT_COMPANY_ID,
      actorUserId: null,
      actorName: "Демо система",
      action: "Обновил(а) профиль кандидата",
      targetName: "Анна Каримова",
      targetStatus: "Скрининг",
      createdAt: new Date(Date.now() - 1000 * 60 * 20),
    },
    {
      id: "90000000-0000-4000-8000-000000000002",
      entityType: "candidate",
      entityId: "33333333-3333-4333-8333-333333333333",
      companyId: DEFAULT_COMPANY_ID,
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
      companyId: DEFAULT_COMPANY_ID,
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
      companyId: DEFAULT_COMPANY_ID,
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
      companyId: DEFAULT_COMPANY_ID,
      actorUserId: null,
      actorName: "Демо система",
      action: "Добавил(а) заметку к кандидату",
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
