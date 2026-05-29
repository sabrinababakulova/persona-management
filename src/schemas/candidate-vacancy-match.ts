import { z } from "zod";

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
 * `reasoning` is a short Russian explanation (one or two sentences) used for
 * debugging and audit logs; it is not currently surfaced to the recruiter.
 */
export const candidateVacancyMatchSchema = z.object({
  score: z.number().int().min(0).max(100),
  reasoning: z.string().max(400),
});

export type CandidateVacancyMatch = z.infer<typeof candidateVacancyMatchSchema>;
