function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

interface TelegramVacancyData {
  title: string;
  level?: string;
  city?: string;
  workType?: string;
  salaryExpectation?: number;
  salaryCurrency?: string;
  workScheduleStart?: string;
  workScheduleEnd?: string;
  tasks?: string;
  team?: string;
  companyDescription?: string;
  comments?: string;
}

export function formatTelegramVacancy(
  vacancy: TelegramVacancyData,
  keyword: string,
): string {
  const lines: string[] = [];

  lines.push(`<b>${escapeHtml(vacancy.title)}</b>`);
  lines.push("");

  if (vacancy.level) {
    lines.push(`<b>Уровень:</b> ${escapeHtml(vacancy.level)}`);
  }
  if (vacancy.city) {
    lines.push(`<b>Город:</b> ${escapeHtml(vacancy.city)}`);
  }
  if (vacancy.workType) {
    lines.push(`<b>Тип работы:</b> ${escapeHtml(vacancy.workType)}`);
  }
  if (vacancy.salaryExpectation) {
    const currency = vacancy.salaryCurrency ?? "UZS";
    lines.push(
      `<b>Зарплата:</b> ${vacancy.salaryExpectation.toLocaleString()} ${escapeHtml(currency)}`,
    );
  }
  if (vacancy.workScheduleStart || vacancy.workScheduleEnd) {
    const start = vacancy.workScheduleStart ?? "—";
    const end = vacancy.workScheduleEnd ?? "—";
    lines.push(`<b>График:</b> ${escapeHtml(start)} – ${escapeHtml(end)}`);
  }

  if (vacancy.tasks) {
    lines.push("");
    lines.push(`<b>Задачи:</b>`);
    lines.push(escapeHtml(vacancy.tasks));
  }

  if (vacancy.team) {
    lines.push("");
    lines.push(`<b>Команда:</b>`);
    lines.push(escapeHtml(vacancy.team));
  }

  if (vacancy.companyDescription) {
    lines.push("");
    lines.push(`<b>О компании:</b>`);
    lines.push(escapeHtml(vacancy.companyDescription));
  }

  if (vacancy.comments) {
    lines.push("");
    lines.push(`<b>Комментарии:</b>`);
    lines.push(escapeHtml(vacancy.comments));
  }

  lines.push("");
  lines.push(`Ваше кодовое слово: <code>${keyword}</code>`);
  lines.push("Вставьте это слово в начало вашего ответа.");

  let message = lines.join("\n");

  // Telegram message limit is 4096 characters
  if (message.length > 4096) {
    const suffix = `\n\nВаше кодовое слово: <code>${keyword}</code>\nВставьте это слово в начало вашего ответа.`;
    const maxContentLength = 4096 - suffix.length - 4; // 4 for "..."
    message = `${message.slice(0, maxContentLength)}...${suffix}`;
  }

  return message;
}
