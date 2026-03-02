export interface Vacancy {
  id: string;
  title: string;
  level: string;
  status: "active" | "draft" | "paused" | "closed" | "archive";
  city: string;
  responses: number;
  workType: string;
  salaryExpectation?: number;
  salaryCurrency?: "UZS" | "USD";
  workScheduleStart?: string;
  workScheduleEnd?: string;
  comments?: string;
  tasks?: string;
  team?: string;
  companyDescription?: string;
  selected?: boolean;
}
