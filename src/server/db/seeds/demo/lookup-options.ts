import type { LookupOption } from "./types";

export const CANDIDATE_CONTACT_TYPES: LookupOption[] = [
  { value: "telegram", label: "Telegram" },
  { value: "phone", label: "Телефон" },
  { value: "email", label: "Email" },
  { value: "whatsapp", label: "WhatsApp" },
];

export const CANDIDATE_SOURCES: LookupOption[] = [
  { value: "hh.uz", label: "hh.uz" },
  { value: "olx", label: "OLX" },
  { value: "telegram", label: "Telegram" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "referral", label: "Реферал" },
  { value: "local", label: "Локальная" },
];

export const CANDIDATE_POSITIONS: LookupOption[] = [
  { value: "frontend_developer", label: "Frontend Developer" },
  { value: "backend_developer", label: "Backend Developer" },
  { value: "fullstack_developer", label: "Fullstack Developer" },
  { value: "product_designer", label: "Product Designer" },
  { value: "graphic_designer", label: "Graphic Designer" },
  { value: "project_manager", label: "Project Manager" },
  { value: "hr_manager", label: "HR Manager" },
  { value: "marketing_manager", label: "Marketing Manager" },
];

export const CANDIDATE_SKILLS: LookupOption[] = [
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

export const CANDIDATE_LANGUAGES: LookupOption[] = [
  { value: "russian", label: "Русский" },
  { value: "uzbek", label: "Узбекский" },
  { value: "english", label: "Английский" },
  { value: "german", label: "Немецкий" },
  { value: "french", label: "Французский" },
  { value: "spanish", label: "Испанский" },
  { value: "korean", label: "Корейский" },
  { value: "chinese", label: "Китайский" },
];

export const CANDIDATE_LANGUAGE_LEVELS: LookupOption[] = [
  { value: "A1", label: "A1 - Начальный" },
  { value: "A2", label: "A2 - Элементарный" },
  { value: "B1", label: "B1 - Средний" },
  { value: "B2", label: "B2 - Выше среднего" },
  { value: "C1", label: "C1 - Продвинутый" },
  { value: "C2", label: "C2 - Владение в совершенстве" },
];

export const CANDIDATE_STATUS_OPTIONS: LookupOption[] = [
  { value: "new", label: "Новый" },
  { value: "screening", label: "Скрининг" },
  { value: "interview", label: "Интервью" },
  { value: "offer", label: "Оффер" },
  { value: "hired", label: "Нанят" },
  { value: "rejected", label: "Отклонен" },
];

export const VACANCY_LEVELS: LookupOption[] = [
  { value: "intern", label: "Стажер" },
  { value: "junior", label: "Джуниор" },
  { value: "middle", label: "Мидл" },
  { value: "senior", label: "Сеньор" },
  { value: "lead", label: "Лид" },
];

export const VACANCY_WORK_TYPES: LookupOption[] = [
  { value: "office", label: "Офис" },
  { value: "remote", label: "Удаленно" },
  { value: "hybrid", label: "Гибрид" },
  { value: "part-time", label: "Частичная занятость" },
];

export const VACANCY_STATUS_OPTIONS: LookupOption[] = [
  { value: "active", label: "Активна" },
  { value: "draft", label: "Черновик" },
  { value: "paused", label: "Приостановлена" },
  { value: "closed", label: "Закрыта" },
  { value: "archive", label: "Архив" },
];

export const VACANCY_SOURCE_OPTIONS: LookupOption[] = [
  { value: "local", label: "Локальная" },
  { value: "hh.uz", label: "hh.uz" },
];
