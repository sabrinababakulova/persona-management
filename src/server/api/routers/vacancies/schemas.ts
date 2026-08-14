import { z } from "zod";

import { periodSchema } from "~/server/api/router-utils/period";
import {
  normalizeOlxUzPhone,
  OLX_UZ_PHONE_INPUT_REGEX,
} from "~/shared/olx-phone";

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

export const vacancyFunnelInputSchema = vacancyIdInputSchema.extend({
  search: z.string().max(255).optional(),
  city: z.string().max(255).optional(),
  sources: z.array(z.string().max(255)).optional(),
  statuses: z.array(z.string().max(50)).optional(),
  stagePagination: z
    .array(
      z.object({
        stage: z.string().min(1).max(50),
        limit: z.number().int().min(1).max(1000),
        offset: z.number().int().min(0),
      }),
    )
    .max(50)
    .optional(),
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

/**
 * PersonHunters-specific publication fields that have no column on the base vacancy. Persisted
 * as a single JSON blob (`vacancy.personHunterMeta`) so the publish form can be re-hydrated when
 * the recruiter edits a PersonHunters publication.
 */
export const personHunterMetaSchema = z.object({
  duties: z.string().max(20000).optional(),
  requirements: z.string().max(20000).optional(),
  conditions: z.string().max(20000).optional(),
  industryId: z.number().int().nonnegative().optional(),
  countryId: z.number().int().nonnegative().optional(),
  regionId: z.number().int().nonnegative().optional(),
  cityId: z.number().int().nonnegative().optional(),
  currencyId: z.number().int().nonnegative().optional(),
  statusId: z.number().int().nonnegative().optional(),
  lang: z.enum(["ru", "uz", "en"]).optional(),
  employmentIds: z.array(z.number().int().positive()).optional(),
  scheduleIds: z.array(z.number().int().positive()).optional(),
  experienceFrom: z.number().int().nonnegative().optional(),
  experienceTo: z.number().int().nonnegative().optional(),
});

export type PersonHunterPublicationMeta = z.infer<
  typeof personHunterMetaSchema
>;

export const olxContactPhoneSchema = z
  .string()
  .trim()
  .max(30)
  .regex(
    OLX_UZ_PHONE_INPUT_REGEX,
    "Введите номер Узбекистана в формате +998 90 123 45 67.",
  )
  .transform((value, ctx) => {
    const normalized = normalizeOlxUzPhone(value);
    if (!normalized) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Не удалось привести номер к формату +998XXXXXXXXX.",
      });
      return z.NEVER;
    }
    return normalized;
  });

/** Values used by olx.uz's own Jobs posting requests. */
export const olxPublicationMetaSchema = z.object({
  categoryId: z.number().int().positive().optional(),
  categoryPath: z
    .array(z.string().trim().min(1).max(120))
    .min(1)
    .max(6)
    .default(["Работа"]),
  location: z.string().trim().min(1).max(255),
  cityId: z.number().int().positive().optional(),
  cityName: z.string().trim().min(1).max(255).optional(),
  regionId: z.number().int().positive().optional(),
  regionName: z.string().trim().min(1).max(255).optional(),
  districtId: z.number().int().positive().optional(),
  districtName: z.string().trim().min(1).max(255).optional(),
  latitude: z.number().finite().min(-90).max(90).optional(),
  longitude: z.number().finite().min(-180).max(180).optional(),
  /** Legacy text fields remain readable so existing drafts can be upgraded. */
  district: z.string().trim().max(255).optional(),
  employmentType: z.string().trim().max(255).optional(),
  schedule: z.string().trim().max(255).optional(),
  experience: z.string().trim().max(255).optional(),
  contactName: z.string().trim().max(255).optional(),
  contactPhone: olxContactPhoneSchema.optional(),
  salaryNegotiable: z.boolean().default(false),
  remoteWork: z.boolean().default(false),
  onlineRecruitment: z.boolean().default(false),
});

export type OlxPublicationMeta = z.infer<typeof olxPublicationMetaSchema>;

export const vacancyCreateInputSchema = z.object({
  id: z.string().min(1).max(255).optional(),
  parentId: z.string().min(1).max(255).optional(),
  title: z.string().min(1, "Название вакансии обязательно").max(255),
  status: z
    .enum(["active", "draft", "paused", "closed", "archive"])
    .default("active"),
  responses: z.number().int().min(0).default(0),
  areaId: z.string().max(20).optional(),
  employmentId: z.string().max(50).optional(),
  scheduleId: z.string().max(50).optional(),
  experienceId: z.string().max(50).optional(),
  professionalRoleId: z.string().max(50).optional(),
  vacancyTypeId: z.string().max(50).optional(),
  billingTypeId: z.string().max(50).optional(),
  salaryFrom: z.number().int().min(0).max(1_000_000_000).optional(),
  salaryTo: z.number().int().min(0).max(1_000_000_000).optional(),
  salaryCurrency: z.enum(["UZS", "USD"]).default("UZS"),
  descriptionHtml: z.string().max(20000).optional(),
  contactPhone: z.string().max(50).optional(),
  telegramFileId: z.string().max(255).optional(),
  isActive: z.boolean().optional(),
  isPublication: z.boolean().optional(),
  destination: z.string().max(255).optional(),
  personHunterMeta: personHunterMetaSchema.optional(),
  olxBrowserMeta: olxPublicationMetaSchema.optional(),
});

export const vacancyUpdateInputSchema = z.object({
  id: z.string().min(1).max(255),
  title: z.string().min(1).max(255).optional(),
  status: z.enum(["active", "draft", "paused", "closed", "archive"]).optional(),
  responses: z.number().int().min(0).optional(),
  areaId: z.string().max(20).nullable().optional(),
  employmentId: z.string().max(50).nullable().optional(),
  scheduleId: z.string().max(50).nullable().optional(),
  experienceId: z.string().max(50).nullable().optional(),
  professionalRoleId: z.string().max(50).nullable().optional(),
  vacancyTypeId: z.string().max(50).nullable().optional(),
  billingTypeId: z.string().max(50).nullable().optional(),
  salaryFrom: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
  salaryTo: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
  salaryCurrency: z.enum(["UZS", "USD"]).optional(),
  descriptionHtml: z.string().max(20000).nullable().optional(),
  contactPhone: z.string().max(50).nullable().optional(),
  telegramFileId: z.string().max(255).nullable().optional(),
  isActive: z.boolean().optional(),
  isPublication: z.boolean().optional(),
  personHunterMeta: personHunterMetaSchema.nullable().optional(),
  olxBrowserMeta: olxPublicationMetaSchema.nullable().optional(),
});

export const vacancyPublicationListInputSchema = z.object({
  parentVacancyId: z.string().min(1).max(255),
});
