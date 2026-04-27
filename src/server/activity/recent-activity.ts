import { recentActivityLogs } from "~/server/db/schema";

type DatabaseClient = typeof import("~/server/db").db;

export function formatActivityTime(date: Date) {
  const diffMs = Date.now() - date.getTime();
  const diffSeconds = Math.max(0, Math.floor(diffMs / 1000));

  if (diffSeconds < 60) {
    return "Только что";
  }

  const minutes = Math.floor(diffSeconds / 60);
  if (minutes < 60) {
    return "Сегодня";
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} ч назад`;
  }

  const days = Math.floor(hours / 24);
  if (days === 1) {
    return "Вчера";
  }

  if (days < 7) {
    return `${days} дн назад`;
  }

  return date.toLocaleDateString("ru-RU");
}

export function buildActivityPreview(value: string, maxLength = 255) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export async function writeRecentActivityLog(
  db: DatabaseClient,
  input: typeof recentActivityLogs.$inferInsert,
) {
  try {
    await db.insert(recentActivityLogs).values(input);
  } catch (error) {
    console.error("Failed to write recent activity log", error);
  }
}
