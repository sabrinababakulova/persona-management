function pad(value: number) {
  return value.toString().padStart(2, "0");
}

export function toMeetingDateValue(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function toMeetingTimeValue(date: Date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function combineMeetingDateTime(dateValue: string, timeValue: string) {
  return new Date(`${dateValue}T${timeValue}:00`);
}

export function getInitialMeetingSlot() {
  const start = new Date();
  start.setSeconds(0, 0);
  start.setMinutes(Math.ceil(start.getMinutes() / 30) * 30);
  if (start.getTime() < Date.now() + 15 * 60 * 1000) {
    start.setMinutes(start.getMinutes() + 30);
  }

  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return { start, end };
}

export function getBrowserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Tashkent";
  } catch {
    return "Asia/Tashkent";
  }
}
