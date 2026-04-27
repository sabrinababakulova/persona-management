import { z } from "zod";

import { periodSchema } from "~/server/api/router-utils/period";

export const vacancyListInputSchema = z
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

export const vacancyIdInputSchema = z.object({
  id: z.string().min(1).max(255),
});

export const vacancyCandidateSearchInputSchema = z.object({
  vacancyId: z.string().min(1).max(255),
  query: z.string().max(255),
  limit: z.number().min(1).max(50).optional(),
  offset: z.number().min(0).optional(),
});

export const vacancyAssignCandidateInputSchema = z.object({
  vacancyId: z.string().min(1).max(255),
  candidateId: z.string().min(1).max(255),
  status: z.string().min(1).max(50),
});

export const vacancyCreateInputSchema = z.object({
  title: z.string().min(1, "Название вакансии обязательно").max(255),
  level: z.string().max(100).optional(),
  status: z
    .enum(["active", "draft", "paused", "closed", "archive"])
    .default("active"),
  city: z.string().max(255).optional(),
  responses: z.number().int().min(0).default(0),
  workType: z.string().max(100).optional(),
  salaryExpectation: z.number().int().min(0).max(1_000_000_000).optional(),
  salaryCurrency: z.enum(["UZS", "USD"]).default("UZS"),
  workScheduleStart: z.string().max(10).optional(),
  workScheduleEnd: z.string().max(10).optional(),
  comments: z.string().max(4000).optional(),
  tasks: z.string().max(4000).optional(),
  team: z.string().max(4000).optional(),
  companyDescription: z.string().max(8000).optional(),
});

export const vacancyUpdateInputSchema = z.object({
  id: z.string().min(1).max(255),
  title: z.string().min(1).max(255).optional(),
  level: z.string().max(100).optional(),
  status: z.enum(["active", "draft", "paused", "closed", "archive"]).optional(),
  city: z.string().max(255).optional(),
  responses: z.number().int().min(0).optional(),
  workType: z.string().max(100).optional(),
  salaryExpectation: z
    .number()
    .int()
    .min(0)
    .max(1_000_000_000)
    .nullable()
    .optional(),
  salaryCurrency: z.enum(["UZS", "USD"]).optional(),
  workScheduleStart: z.string().max(10).optional(),
  workScheduleEnd: z.string().max(10).optional(),
  comments: z.string().max(4000).optional(),
  tasks: z.string().max(4000).optional(),
  team: z.string().max(4000).optional(),
  companyDescription: z.string().max(8000).optional(),
});

export const vacancyPublicationListInputSchema = z.object({
  vacancyId: z.string().min(1).max(255),
  activeOnly: z.boolean().optional().default(false),
});
