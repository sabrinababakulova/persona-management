import { z } from "zod";

import { localizedTextSchema } from "~/shared/localized-ai";

export const candidateResumeSummarySchema = z.object({
  summaries: localizedTextSchema,
  // The generator normalizes each value to four words after structured-output
  // parsing, allowing it to repair an overlong model response instead of
  // discarding the whole analysis.
  tags: z.array(z.string().trim().min(1).max(64)).min(1).max(3),
});

export type CandidateResumeSummary = z.infer<
  typeof candidateResumeSummarySchema
>;
