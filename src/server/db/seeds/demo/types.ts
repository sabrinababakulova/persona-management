import type * as schema from "~/server/db/schema";

export type LookupOption = { value: string; label: string };
export type SeedRow = LookupOption & { sortOrder: number; isActive: boolean };
export type DemoCandidate = typeof schema.candidates.$inferInsert & {
  id: string;
};
export type DemoVacancy = Omit<
  typeof schema.vacancies.$inferInsert,
  "parentId"
> & { id: string; parentId?: string };
export type DemoRecentActivity =
  typeof schema.recentActivityLogs.$inferInsert & {
    id: string;
  };
