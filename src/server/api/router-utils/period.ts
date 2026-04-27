import { z } from "zod";

export const periodSchema = z.enum(["day", "week", "month", "year"]);

export type Period = z.infer<typeof periodSchema>;

export function getPeriodDateCutoff(period: Period) {
  const cutoff = new Date();

  switch (period) {
    case "day":
      cutoff.setDate(cutoff.getDate() - 1);
      break;
    case "week":
      cutoff.setDate(cutoff.getDate() - 7);
      break;
    case "month":
      cutoff.setMonth(cutoff.getMonth() - 1);
      break;
    case "year":
      cutoff.setFullYear(cutoff.getFullYear() - 1);
      break;
  }

  return cutoff;
}
