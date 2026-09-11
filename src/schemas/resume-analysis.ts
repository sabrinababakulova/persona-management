import { z } from "zod";

const nullableExtractedStringSchema = z.string().nullable().optional();

export const resumeExtractedContactSchema = z.object({
  type: nullableExtractedStringSchema,
  value: nullableExtractedStringSchema,
});

export const resumeExtractedLanguageSchema = z.object({
  name: nullableExtractedStringSchema,
  level: nullableExtractedStringSchema,
});

export const resumeExtractedWorkExperienceSchema = z.object({
  company: nullableExtractedStringSchema,
  position: nullableExtractedStringSchema,
  period: nullableExtractedStringSchema,
  description: z
    .union([z.array(z.string().nullable()), z.string()])
    .nullable()
    .optional(),
});

export const resumeExtractedEducationSchema = z.object({
  institution: nullableExtractedStringSchema,
  gpa: nullableExtractedStringSchema,
  period: nullableExtractedStringSchema,
});

export const candidateResumePrefillSchema = z.object({
  fullName: nullableExtractedStringSchema,
  city: nullableExtractedStringSchema,
  contacts: z.array(resumeExtractedContactSchema).nullable().optional(),
  source: nullableExtractedStringSchema,
  salaryExpectation: z.union([z.number(), z.string()]).nullable().optional(),
  salaryCurrency: nullableExtractedStringSchema,
  vacancyLevel: nullableExtractedStringSchema,
  currentPosition: nullableExtractedStringSchema,
  skills: z.array(z.string().nullable()).nullable().optional(),
  languages: z.array(resumeExtractedLanguageSchema).nullable().optional(),
  workExperience: z
    .array(resumeExtractedWorkExperienceSchema)
    .nullable()
    .optional(),
  education: z.array(resumeExtractedEducationSchema).nullable().optional(),
  status: nullableExtractedStringSchema,
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
  vacancyLevel: z.string(),
  currentPosition: z.string(),
  skills: z.array(z.string()),
  languages: z.array(
    z.object({
      name: z.string(),
      level: z.string(),
    }),
  ),
  workExperience: z.array(
    z.object({
      company: z.string(),
      position: z.string(),
      period: z.string(),
      description: z.array(z.string()),
    }),
  ),
  education: z.array(
    z.object({
      institution: z.string(),
      gpa: z.string(),
      period: z.string(),
    }),
  ),
  status: z.string(),
});

export type CandidateResumePrefillData = z.infer<
  typeof candidateResumePrefillDataSchema
>;
