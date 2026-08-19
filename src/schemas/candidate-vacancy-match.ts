import { z } from "zod";

import {
  localizedStringListSchema,
  localizedTextSchema,
} from "~/shared/localized-ai";

/**
 * Structured output of the candidate ↔ vacancy match agent.
 *
 * `score` is a calibrated 0–100 integer modelled on the weight breakdown used
 * by enterprise ATS systems (Workable / Greenhouse / Jobvite parsing engines)
 * where skills + role similarity dominate, experience and language make up the
 * middle tier, and salary / location / education round out the tail. The agent
 * applies that rubric holistically rather than as a keyword count, so the score
 * reflects qualitative fit and not just term frequency.
 *
 * The score is language-independent. `analysis`, `matchedRequirements`, and
 * `missingRequirements` contain equivalent Russian, English, and Uzbek
 * recruiter-facing versions. They are stored per application and the API
 * selects the current UI locale.
 */
export const candidateVacancyMatchSchema = z.object({
  score: z.number().int().min(0).max(100),
  analysis: localizedTextSchema,
  matchedRequirements: localizedStringListSchema,
  missingRequirements: localizedStringListSchema,
});

export type CandidateVacancyMatch = z.infer<typeof candidateVacancyMatchSchema>;
