import { z } from "zod";

import { AI_TAG_MAX_WORDS, countAiTagWords } from "~/shared/ai-tags";
import { localizedTextSchema } from "~/shared/localized-ai";

export type CandidateValidationMessages = {
  contactType: string;
  contactRequired: string;
  language: string;
  languageLevel: string;
  company: string;
  position: string;
  period: string;
  description: string;
  experienceDescription: string;
  institution: string;
  gpaTooLong: string;
  fullName: string;
  city: string;
};

const russianMessages: CandidateValidationMessages = {
  contactType: "Выберите тип контакта",
  contactRequired: "Контакт обязателен",
  language: "Выберите язык",
  languageLevel: "Выберите уровень",
  company: "Укажите компанию",
  position: "Укажите должность",
  period: "Укажите период",
  description: "Добавьте описание",
  experienceDescription: "Добавьте хотя бы один пункт опыта",
  institution: "Укажите учебное заведение",
  gpaTooLong: "GPA или оценка не должны превышать 200 символов",
  fullName: "Ф.И.О обязательно",
  city: "Город обязателен",
};

export function createCandidateFormSchema(
  messages: CandidateValidationMessages = russianMessages,
) {
  const contactSchema = z.object({
    type: z.string().min(1, messages.contactType),
    value: z.string().min(1, messages.contactRequired),
  });

  const languageSchema = z.object({
    name: z.string().min(1, messages.language),
    level: z.string().min(1, messages.languageLevel),
  });

  const workExperienceSchema = z.object({
    company: z.string().min(1, messages.company),
    position: z.string().min(1, messages.position),
    period: z.string().min(1, messages.period),
    isCurrent: z.boolean().optional(),
    description: z
      .array(z.string().min(1, messages.description))
      .min(1, messages.experienceDescription),
  });

  const educationSchema = z.object({
    institution: z.string().min(1, messages.institution),
    gpa: z.string().max(200, messages.gpaTooLong),
    period: z.string().max(255).optional().default(""),
    isCurrent: z.boolean().optional(),
  });

  return z.object({
    fullName: z.string().min(1, messages.fullName),
    city: z.string().min(1, messages.city),
    contacts: z.array(contactSchema).default([]),
    source: z.string().optional(),
    salaryExpectation: z.number().min(0).optional(),
    salaryCurrency: z.enum(["UZS", "USD"]).default("UZS"),
    currentPosition: z.string().optional(),
    skills: z.array(z.string()).default([]),
    languages: z.array(languageSchema).default([]),
    workExperience: z.array(workExperienceSchema).default([]),
    education: z.array(educationSchema).default([]),
    status: z.string().default("new"),
    aiAnalysis: z.string().max(5000).optional(),
    aiAnalysisTranslations: localizedTextSchema.optional(),
    tags: z
      .array(
        z
          .string()
          .trim()
          .min(1)
          .max(64)
          .refine((tag) => countAiTagWords(tag) <= AI_TAG_MAX_WORDS),
      )
      .max(3)
      .default([]),
    resumeFileId: z.string().optional(),
    resumeFileName: z.string().optional(),
    resumeFileSize: z.string().optional(),
  });
}

export const candidateFormSchema = createCandidateFormSchema();

export type CandidateFormInput = z.infer<typeof candidateFormSchema>;
