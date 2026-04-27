import { DEFAULT_COMPANY_ID } from "~/shared/default-company";
import type { DemoCandidate } from "./types";

export const DEMO_CANDIDATES: DemoCandidate[] = [
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
