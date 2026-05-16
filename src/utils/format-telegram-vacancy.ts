function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

interface TelegramVacancyData {
  title: string;
  areaId?: string;
  employmentId?: string;
  scheduleId?: string;
  experienceId?: string;
  professionalRoleId?: string;
  salaryFrom?: number;
  salaryTo?: number;
  salaryCurrency?: string;
  descriptionHtml?: string;
  contactPhone?: string;
}

export function formatTelegramVacancy(
  vacancy: TelegramVacancyData,
  keyword: string,
  maxLength = 4096,
): string {
  const lines: string[] = [];

  lines.push(`<b>${escapeHtml(vacancy.title)}</b>`);
  lines.push("");

  if (vacancy.areaId) {
    lines.push(`<b>Регион (hh.uz):</b> ${escapeHtml(vacancy.areaId)}`);
  }
  if (vacancy.employmentId) {
    lines.push(`<b>Тип занятости:</b> ${escapeHtml(vacancy.employmentId)}`);
  }
  if (vacancy.scheduleId) {
    lines.push(`<b>График:</b> ${escapeHtml(vacancy.scheduleId)}`);
  }
  if (vacancy.experienceId) {
    lines.push(`<b>Опыт:</b> ${escapeHtml(vacancy.experienceId)}`);
  }
  if (vacancy.professionalRoleId) {
    lines.push(`<b>Роль:</b> ${escapeHtml(vacancy.professionalRoleId)}`);
  }
  if (vacancy.salaryFrom !== undefined || vacancy.salaryTo !== undefined) {
    const currency = vacancy.salaryCurrency ?? "UZS";
    const range = [vacancy.salaryFrom, vacancy.salaryTo]
      .filter((value): value is number => typeof value === "number")
      .map((value) => value.toLocaleString())
      .join(" – ");
    if (range) {
      lines.push(`<b>Зарплата:</b> ${range} ${escapeHtml(currency)}`);
    }
  }
  if (vacancy.contactPhone) {
    lines.push(`<b>Контакт:</b> ${escapeHtml(vacancy.contactPhone)}`);
  }

  if (vacancy.descriptionHtml) {
    const descriptionText = stripHtml(vacancy.descriptionHtml);
    if (descriptionText) {
      lines.push("");
      lines.push(`<b>Описание:</b>`);
      lines.push(escapeHtml(descriptionText));
    }
  }

  lines.push("");
  lines.push(`Ваше кодовое слово: <code>${keyword}</code>`);
  lines.push("Вставьте это слово в начало вашего ответа.");

  let message = lines.join("\n");

  // Telegram caps plain messages at 4096 characters and photo captions at 1024 — callers pass
  // the relevant limit via `maxLength`.
  if (message.length > maxLength) {
    const suffix = `\n\nВаше кодовое слово: <code>${keyword}</code>\nВставьте это слово в начало вашего ответа.`;
    const maxContentLength = maxLength - suffix.length - 4; // 4 for "..."
    message = `${message.slice(0, maxContentLength)}...${suffix}`;
  }

  return message;
}
