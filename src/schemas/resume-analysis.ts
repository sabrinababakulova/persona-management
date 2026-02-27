import { z } from "zod";

export const resumeExtractedContactSchema = z.object({
  type: z.string(),
  value: z.string(),
});

export const resumeExtractedLanguageSchema = z.object({
  name: z.string(),
  level: z.string(),
});

export const candidateResumePrefillSchema = z.object({
  fullName: z.string(),
  city: z.string(),
  contacts: z.array(resumeExtractedContactSchema),
  source: z.string(),
  salaryExpectation: z.number().nullable().optional(),
  salaryCurrency: z.enum(["UZS", "USD"]).optional(),
  currentPosition: z.string(),
  skills: z.array(z.string()),
  languages: z.array(resumeExtractedLanguageSchema),
  status: z.string().optional(),
});

export type CandidateResumePrefill = z.infer<
  typeof candidateResumePrefillSchema
>;

export const candidateResumePrefillDataSchema = z.object({
  fullName: z.string(),
  city: z.string(),
  contacts: z.array(
    z.object({
      type: z.string(),
      value: z.string(),
    }),
  ),
  source: z.string(),
  salaryExpectation: z.number().optional(),
  salaryCurrency: z.enum(["UZS", "USD"]),
  currentPosition: z.string(),
  skills: z.array(z.string()),
  languages: z.array(
    z.object({
      name: z.string(),
      level: z.string(),
    }),
  ),
  status: z.string(),
});

export type CandidateResumePrefillData = z.infer<
  typeof candidateResumePrefillDataSchema
>;
