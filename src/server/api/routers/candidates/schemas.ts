import { z } from "zod";

import { periodSchema } from "~/server/api/router-utils/period";

export const candidateListInputSchema = z
  .object({
    period: periodSchema.optional().default("week"),
    search: z.string().max(255).optional(),
    statuses: z.array(z.string().max(50)).optional(),
    city: z.string().max(255).optional(),
    sources: z.array(z.string().max(255)).optional(),
    limit: z.number().min(1).max(100).optional(),
    offset: z.number().min(0).optional(),
  })
  .optional();

export const candidateUploadResumeInputSchema = z.object({
  candidateId: z.string().uuid(),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().max(255).optional().default(""),
  fileBase64: z.string().min(1),
  previousResumeFileId: z.string().max(255).optional(),
});

export const candidateIdInputSchema = z.object({ id: z.string() });

export const candidateNoteInputSchema = z.object({
  candidateId: z.string().min(1).max(255),
  content: z
    .string()
    .trim()
    .min(1, "Текст заметки обязателен")
    .max(2000, "Заметка не должна превышать 2000 символов"),
});

export const candidateCreateInputSchema = z.object({
  id: z.string().uuid().optional(),
  fullName: z.string().min(1, "Ф.И.О обязательно").max(255),
  city: z.string().min(1, "Город обязателен").max(255),
  contacts: z
    .array(
      z.object({
        type: z.string().min(1).max(50),
        value: z.string().max(255),
      }),
    )
    .max(20)
    .default([]),
  source: z.string().max(255).optional(),
  salaryExpectation: z.number().min(0).max(1_000_000_000).optional(),
  salaryCurrency: z.enum(["UZS", "USD"]).default("UZS"),
  currentPosition: z.string().max(255).optional(),
  skills: z.array(z.string().max(255)).max(50).default([]),
  languages: z
    .array(
      z.object({
        name: z.string().max(255),
        level: z.string().max(10),
      }),
    )
    .max(20)
    .default([]),
  workExperience: z
    .array(
      z.object({
        company: z.string().min(1).max(255),
        position: z.string().min(1).max(255),
        period: z.string().min(1).max(255),
        isCurrent: z.boolean().optional(),
        description: z.array(z.string().min(1).max(1000)).max(20).default([]),
      }),
    )
    .max(20)
    .default([]),
  education: z
    .array(
      z.object({
        institution: z.string().min(1).max(255),
        gpa: z.string().min(1).max(50),
        period: z.string().min(1).max(255),
        isCurrent: z.boolean().optional(),
      }),
    )
    .max(20)
    .default([]),
  status: z.string().max(50).default("new"),
  aiAnalysis: z.string().max(5000).optional(),
  resumeFileId: z.string().max(255).optional(),
  resumeFileName: z.string().max(255).optional(),
  resumeFileSize: z.string().max(50).optional(),
});

export const candidateUpdateInputSchema = z.object({
  id: z.string().min(1).max(255),
  fullName: z.string().min(1).max(255).optional(),
  city: z.string().min(1).max(255).optional(),
  source: z.string().max(255).optional(),
  status: z.string().max(50).optional(),
  currentPosition: z.string().max(255).optional(),
});
