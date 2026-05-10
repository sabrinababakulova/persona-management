export interface Vacancy {
  id: string;
  title: string;
  status: "active" | "draft" | "paused" | "closed" | "archive";
  responses: number;
  areaId: string;
  employmentId: string;
  scheduleId: string;
  experienceId: string;
  professionalRoleId: string;
  billingTypeId: string;
  salaryFrom?: number;
  salaryTo?: number;
  salaryCurrency?: "UZS" | "USD";
  descriptionHtml: string;
  contactPhone: string;
  companyId?: string;
  hhVacancyId?: string | null;
  publishedAt?: string;
  source: "local" | "hh.uz";
  externalUrl?: string;
  connections: Array<"telegram" | "hh.uz">;
  selected?: boolean;
}
