import { z } from "zod";

export const candidateContactSchema = z.object({
  type: z.string().min(1, "Выберите тип контакта"),
  value: z.string().min(1, "Контакт обязателен"),
});

export const candidateLanguageSchema = z.object({
  name: z.string().min(1, "Выберите язык"),
  level: z.string().min(1, "Выберите уровень"),
});

export const candidateWorkExperienceSchema = z.object({
  company: z.string().min(1, "Укажите компанию"),
  position: z.string().min(1, "Укажите должность"),
  period: z.string().min(1, "Укажите период"),
  isCurrent: z.boolean().optional(),
  description: z
    .array(z.string().min(1, "Добавьте описание"))
    .min(1, "Добавьте хотя бы один пункт опыта"),
});

export const candidateEducationSchema = z.object({
  institution: z.string().min(1, "Укажите учебное заведение"),
  gpa: z.string().min(1, "Укажите GPA или оценку"),
  period: z.string().min(1, "Укажите период обучения"),
  isCurrent: z.boolean().optional(),
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
  workExperience: z.array(candidateWorkExperienceSchema).default([]),
  education: z.array(candidateEducationSchema).default([]),
  vacancyId: z.string().uuid().optional(),
  status: z.string().default("new"),
  aiAnalysis: z.string().max(5000).optional(),
  resumeFileId: z.string().optional(),
  resumeFileName: z.string().optional(),
  resumeFileSize: z.string().optional(),
});

export type CandidateFormInput = z.infer<typeof candidateFormSchema>;
