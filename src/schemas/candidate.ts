import { z } from "zod";

export const candidateContactSchema = z.object({
  type: z.string().min(1, "Выберите тип контакта"),
  value: z.string().min(1, "Контакт обязателен"),
});

export const candidateLanguageSchema = z.object({
  name: z.string().min(1, "Выберите язык"),
  level: z.string().min(1, "Выберите уровень"),
});

export const candidateFormSchema = z.object({
  fullName: z.string().min(1, "Ф.И.О обязательно"),
  city: z.string().min(1, "Город обязателен"),
  contacts: z.array(candidateContactSchema).default([]),
  source: z.string().optional(),
  salaryExpectation: z.number().min(0).optional(),
  salaryCurrency: z.enum(["UZS", "USD"]).default("UZS"),
  currentPosition: z.string().optional(),
  skills: z.array(z.string()).default([]),
  languages: z.array(candidateLanguageSchema).default([]),
  status: z.string().default("new"),
  resumeUrl: z.string().optional(),
  resumeFileName: z.string().optional(),
  resumeFileSize: z.string().optional(),
});

export type CandidateFormInput = z.infer<typeof candidateFormSchema>;
