import type { VacancyLookups } from "~/types/shared/vacancy-lookups";

export const DEFAULT_VACANCY_LOOKUPS: VacancyLookups = {
  levels: [
    { value: "intern", label: "Стажер" },
    { value: "junior", label: "Джуниор" },
    { value: "middle", label: "Мидл" },
    { value: "senior", label: "Сеньор" },
    { value: "lead", label: "Лид" },
  ],
  workTypes: [
    { value: "office", label: "Офис" },
    { value: "remote", label: "Удаленно" },
    { value: "hybrid", label: "Гибрид" },
    { value: "part-time", label: "Частичная занятость" },
  ],
  statusOptions: [
    { value: "active", label: "Активна" },
    { value: "draft", label: "Черновик" },
    { value: "paused", label: "Приостановлена" },
    { value: "closed", label: "Закрыта" },
    { value: "archive", label: "Архив" },
  ],
};
