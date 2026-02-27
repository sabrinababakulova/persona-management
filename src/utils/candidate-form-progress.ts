import type { CandidateFormData } from "~/types/candidates/candidate-form-data";

export type CandidateRequiredField = {
  key: keyof CandidateFormData;
  label: string;
};

export function calculateCandidateFormProgress(
  formData: CandidateFormData,
  requiredFields: readonly CandidateRequiredField[],
) {
  let filled = 0;
  const total = requiredFields.length;
  const missing: string[] = [];

  for (const field of requiredFields) {
    const value = formData[field.key];
    if (
      value !== undefined &&
      value !== null &&
      (typeof value !== "string" || value.trim() !== "")
    ) {
      filled += 1;
    } else {
      missing.push(field.label);
    }
  }

  return {
    percentage: total > 0 ? Math.round((filled / total) * 100) : 0,
    filled,
    total,
    missing,
  };
}
