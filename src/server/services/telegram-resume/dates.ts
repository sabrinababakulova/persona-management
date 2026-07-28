export function parseDatabaseTimestamp(value: unknown): Date | null {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(
      "Telegram resume job contains an invalid message timestamp",
    );
  }
  return parsed;
}
