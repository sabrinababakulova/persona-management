import { z } from "zod";

export const candidateResumeClassificationSchema = z.object({
  isResume: z.boolean(),
  reason: z.string().trim().min(1).max(500),
});

export type CandidateResumeClassification = z.infer<
  typeof candidateResumeClassificationSchema
>;
