import { z } from "zod";

import { localizedTextSchema } from "~/shared/localized-ai";

export const candidateResumeSummarySchema = z.object({
  summaries: localizedTextSchema,
});

export type CandidateResumeSummary = z.infer<
  typeof candidateResumeSummarySchema
>;
