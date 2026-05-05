import { DEFAULT_COMPANY_ID } from "~/shared/default-company";
import type { DemoVacancy } from "./types";

// Each entry mirrors the new hh.uz-shaped vacancy schema. Lookup IDs (areaId, employmentId,
// scheduleId, experienceId, professionalRoleId, billingTypeId) are intentionally left blank
// in seeds because they are tied to live hh.uz dictionary values that vary by environment;
// they should be filled in via the create form against the resolved dictionaries.
export const DEMO_VACANCIES: DemoVacancy[] = [
  {
    id: "aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    title: "Senior Frontend Developer",
    status: "active",
    responses: 18,
    salaryFrom: 3500,
    salaryCurrency: "USD",
    descriptionHtml:
      "<p>Разработка новых интерфейсов, участие в архитектурных решениях, взаимодействие с дизайнерами и backend-командой.</p>",
    companyId: DEFAULT_COMPANY_ID,
  },
  {
    id: "aaaaaaa2-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
    title: "Product Designer",
    status: "active",
    responses: 11,
    salaryFrom: 2400,
    salaryCurrency: "USD",
    descriptionHtml:
      "<p>Проектирование пользовательских сценариев, подготовка макетов, тестирование гипотез вместе с продакт-менеджером.</p>",
    companyId: DEFAULT_COMPANY_ID,
  },
  {
    id: "aaaaaaa3-aaaa-4aaa-8aaa-aaaaaaaaaaa3",
    title: "HR Manager",
    status: "draft",
    responses: 3,
    salaryFrom: 14000000,
    salaryCurrency: "UZS",
    descriptionHtml:
      "<p>Полный цикл подбора, координация интервью, ведение базы кандидатов и аналитики по каналам.</p>",
    companyId: DEFAULT_COMPANY_ID,
  },
  {
    id: "aaaaaaa4-aaaa-4aaa-8aaa-aaaaaaaaaaa4",
    title: "Backend Developer",
    status: "closed",
    responses: 24,
    salaryFrom: 2800,
    salaryCurrency: "USD",
    descriptionHtml:
      "<p>Разработка API, интеграции с внешними сервисами, оптимизация производительности серверной части.</p>",
    companyId: DEFAULT_COMPANY_ID,
  },
  {
    id: "aaaaaaa5-aaaa-4aaa-8aaa-aaaaaaaaaaa5",
    title: "Middle Fullstack Developer",
    status: "active",
    responses: 16,
    salaryFrom: 3000,
    salaryCurrency: "USD",
    descriptionHtml:
      "<p>Разработка фич на frontend и backend, участие в продуктовых созвонах и ревью решений.</p>",
    companyId: DEFAULT_COMPANY_ID,
  },
  {
    id: "aaaaaaa6-aaaa-4aaa-8aaa-aaaaaaaaaaa6",
    title: "Junior Recruiter",
    status: "active",
    responses: 9,
    salaryFrom: 9000000,
    salaryCurrency: "UZS",
    descriptionHtml:
      "<p>Поиск кандидатов, первичный контакт, координация интервью и ведение статусов.</p>",
    companyId: DEFAULT_COMPANY_ID,
  },
  {
    id: "aaaaaaa7-aaaa-4aaa-8aaa-aaaaaaaaaaa7",
    title: "Graphic Designer",
    status: "paused",
    responses: 7,
    salaryFrom: 1800,
    salaryCurrency: "USD",
    descriptionHtml:
      "<p>Подготовка визуалов для маркетинга, соцсетей, сайта и рекламных кампаний.</p>",
    companyId: DEFAULT_COMPANY_ID,
  },
  {
    id: "aaaaaaa8-aaaa-4aaa-8aaa-aaaaaaaaaaa8",
    title: "Project Manager",
    status: "active",
    responses: 13,
    salaryFrom: 2300,
    salaryCurrency: "USD",
    descriptionHtml:
      "<p>Планирование спринтов, контроль сроков, фасилитация встреч и синхронизация команд.</p>",
    companyId: DEFAULT_COMPANY_ID,
  },
  {
    id: "aaaaaaa9-aaaa-4aaa-8aaa-aaaaaaaaaaa9",
    title: "Marketing Manager",
    status: "active",
    responses: 21,
    salaryFrom: 2000,
    salaryCurrency: "USD",
    descriptionHtml:
      "<p>Запуск кампаний, аналитика CAC и CPL, работа с контентом и лидогенерацией.</p>",
    companyId: DEFAULT_COMPANY_ID,
  },
  {
    id: "aaaaaa10-aaaa-4aaa-8aaa-aaaaaaaaaa10",
    title: "Senior Backend Engineer",
    status: "active",
    responses: 19,
    salaryFrom: 4200,
    salaryCurrency: "USD",
    descriptionHtml:
      "<p>Проектирование сервисов, ревью архитектуры, оптимизация производительности и надежности.</p>",
    companyId: DEFAULT_COMPANY_ID,
  },
  {
    id: "aaaaaa11-aaaa-4aaa-8aaa-aaaaaaaaaa11",
    title: "Talent Sourcer",
    status: "draft",
    responses: 2,
    salaryFrom: 8000000,
    salaryCurrency: "UZS",
    descriptionHtml:
      "<p>Поиск кандидатов, оформление short-list, обновление базы и коммуникация с рекрутерами.</p>",
    companyId: DEFAULT_COMPANY_ID,
  },
  {
    id: "aaaaaa12-aaaa-4aaa-8aaa-aaaaaaaaaa12",
    title: "UX Researcher",
    status: "paused",
    responses: 5,
    salaryFrom: 2200,
    salaryCurrency: "USD",
    descriptionHtml:
      "<p>Проведение интервью, качественные и количественные исследования, синтез инсайтов для продукта.</p>",
    companyId: DEFAULT_COMPANY_ID,
  },
  {
    id: "aaaaaa13-aaaa-4aaa-8aaa-aaaaaaaaaa13",
    title: "Frontend Team Lead",
    status: "active",
    responses: 14,
    salaryFrom: 4800,
    salaryCurrency: "USD",
    descriptionHtml:
      "<p>Развитие frontend-команды, архитектурные решения, менторинг и участие в критичных задачах.</p>",
    companyId: DEFAULT_COMPANY_ID,
  },
  {
    id: "aaaaaa14-aaaa-4aaa-8aaa-aaaaaaaaaa14",
    title: "QA Engineer",
    status: "closed",
    responses: 12,
    salaryFrom: 1700,
    salaryCurrency: "USD",
    descriptionHtml:
      "<p>Функциональное тестирование, регресс, написание тест-кейсов и участие в релизных проверках.</p>",
    companyId: DEFAULT_COMPANY_ID,
  },
  {
    id: "aaaaaa15-aaaa-4aaa-8aaa-aaaaaaaaaa15",
    title: "Office Manager",
    status: "archive",
    responses: 8,
    salaryFrom: 7000000,
    salaryCurrency: "UZS",
    descriptionHtml:
      "<p>Поддержка офиса, координация поставщиков, организация командных мероприятий и документооборот.</p>",
    companyId: DEFAULT_COMPANY_ID,
  },
];
