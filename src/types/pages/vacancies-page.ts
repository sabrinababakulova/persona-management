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
  tasks?: string;
  team?: string;
  companyDescription?: string;
  selected?: boolean;
}
