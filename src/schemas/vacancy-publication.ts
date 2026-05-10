import { z } from "zod";

export const vacancyPublicationSourcePlatformSchema = z.enum([
  "telegram",
  "hh.uz",
]);

export const vacancyPublicationSourceSchema = z.object({
  platform: vacancyPublicationSourcePlatformSchema,
  url: z.string().url().max(1000).optional(),
  keyword: z.string().min(1).max(100).optional(),
  sentTo: z.number().int().min(0).optional(),
  postedAt: z.string().datetime().optional(),
});

export const createVacancyPublicationSchema = z.object({
  vacancyId: z.string().min(1).max(255),
  name: z.string().min(1, "Название публикации обязательно").max(255),
  description: z.string().max(8000).optional().default(""),
  isActive: z.boolean().optional().default(true),
  sources: z
    .array(vacancyPublicationSourceSchema)
    .refine(
      (sources) =>
        new Set(sources.map((source) => source.platform)).size ===
        sources.length,
      "Каждая платформа может быть указана только один раз",
    )
    .optional()
    .default([]),
});

export const updateVacancyPublicationSchema = z.object({
  id: z.string().min(1).max(255),
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(8000).optional(),
  isActive: z.boolean().optional(),
  sources: z
    .array(vacancyPublicationSourceSchema)
    .refine(
      (sources) =>
        new Set(sources.map((source) => source.platform)).size ===
        sources.length,
      "Каждая платформа может быть указана только один раз",
    )
    .optional(),
});

export const deleteVacancyPublicationSchema = z.object({
  id: z.string().min(1).max(255),
});

export type VacancyPublicationSource = z.infer<
  typeof vacancyPublicationSourceSchema
>;
