import { createHash } from "node:crypto";

export function generateVacancyKeyword(
  vacancyId: string,
  companyId: string,
): string {
  return createHash("sha256")
    .update(vacancyId + companyId)
    .digest("hex")
    .slice(0, 8);
}
