import { z } from "zod";

export const resumeExtractedContactSchema = z.object({
  type: z.string(),
  value: z.string(),
});

export const resumeExtractedLanguageSchema = z.object({
  name: z.string(),
  level: z.string(),
});

export const resumeExtractedWorkExperienceSchema = z.object({
  company: z.string(),
  position: z.string(),
  period: z.string(),
  description: z.array(z.string()),
});

export const resumeExtractedEducationSchema = z.object({
  institution: z.string(),
  gpa: z.string(),
  period: z.string(),
});

export const candidateResumePrefillSchema = z.object({
  fullName: z.string(),
  city: z.string(),
  contacts: z.array(resumeExtractedContactSchema),
  source: z.string(),
  salaryExpectation: z.number().nullable().optional(),
  salaryCurrency: z.enum(["UZS", "USD"]).optional(),
  vacancyLevel: z.string().optional(),
  currentPosition: z.string(),
  skills: z.array(z.string()),
  languages: z.array(resumeExtractedLanguageSchema),
  workExperience: z.array(resumeExtractedWorkExperienceSchema),
  education: z.array(resumeExtractedEducationSchema),
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
