import { z } from "zod";

import { periodSchema } from "~/server/api/router-utils/period";

/** Optional filters and pagination accepted by candidate list endpoints. */
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

/** Resume upload payload sent from the candidate form before server-side PDF validation. */
export const candidateUploadResumeInputSchema = z.object({
  candidateId: z.string().uuid(),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().max(255).optional().default(""),
  fileBase64: z.string().min(1),
  previousResumeFileId: z.string().max(255).optional(),
});

/** Generic candidate identifier input for detail reads. */
export const candidateIdInputSchema = z.object({ id: z.string() });

/** Input for appending a note to an existing candidate. */
export const candidateNoteInputSchema = z.object({
  candidateId: z.string().min(1).max(255),
  content: z
    .string()
    .trim()
    .min(1, "Текст заметки обязателен")
    .max(2000, "Заметка не должна превышать 2000 символов"),
});

function isSupportedTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** Meeting data selected in the candidate calendar before an RSVP email is sent. */
export const candidateMeetingInputSchema = z
  .object({
    candidateId: z.string().min(1).max(255),
    title: z
      .string()
      .trim()
      .min(1, "Введите название встречи")
      .max(255, "Название не должно превышать 255 символов"),
    description: z.string().trim().max(5000).optional(),
    location: z.string().trim().max(500).optional(),
    startAt: z.date(),
    endAt: z.date(),
    timeZone: z
      .string()
      .min(1)
      .max(100)
      .refine(isSupportedTimeZone, "Неизвестный часовой пояс"),
  })
  .superRefine((input, context) => {
    if (input.startAt.getTime() < Date.now() - 60_000) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Встречу нельзя назначить в прошлом",
        path: ["startAt"],
      });
    }

    const durationMs = input.endAt.getTime() - input.startAt.getTime();
    if (durationMs <= 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Время окончания должно быть позже времени начала",
        path: ["endAt"],
      });
    } else if (durationMs > 8 * 60 * 60 * 1000) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Встреча не может длиться дольше 8 часов",
        path: ["endAt"],
      });
    }
  });

/** Candidate picker search used by the recruiter-level meeting modal. */
export const meetingCandidateSearchInputSchema = z
  .object({
    query: z.string().trim().max(255).optional().default(""),
  })
  .optional();

/** Full candidate profile payload used when creating a stored candidate. */
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

/** Limited editable fields supported by the candidate list/detail quick update flow. */
export const candidateUpdateInputSchema = z.object({
  id: z.string().min(1).max(255),
  fullName: z.string().min(1).max(255).optional(),
  city: z.string().min(1).max(255).optional(),
  source: z.string().max(255).optional(),
  status: z.string().max(50).optional(),
  currentPosition: z.string().max(255).optional(),
});
