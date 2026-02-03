import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import {
  candidateContactTypes,
  candidateLanguageLevels,
  candidateLanguages,
  candidatePositions,
  candidateSkills,
  candidateSources,
  candidateStatusOptions,
  candidates,
} from "~/server/db/schema";

// Types for candidate data
const _candidateSchema = z.object({
  id: z.string(),
  name: z.string(),
  patronymic: z.string(),
  city: z.string(),
  stage: z.enum(["offer", "interview", "hired"]),
  otherResponses: z.array(z.string()),
  createdAt: z.string(),
  source: z.string(),
  selected: z.boolean().optional(),
});

// Detailed candidate type
const WorkExperience = z.object({
  company: z.string(),
  position: z.string(),
  period: z.string(),
  isCurrent: z.boolean().optional(),
  description: z.array(z.string()),
});

const Education = z.object({
  institution: z.string(),
  gpa: z.string(),
  period: z.string(),
  isCurrent: z.boolean().optional(),
});

const Note = z.object({
  id: z.string(),
  content: z.string(),
  author: z.string(),
  createdAt: z.string(),
});

const Activity = z.object({
  id: z.string(),
  userName: z.string(),
  userAvatar: z.string(),
  action: z.string(),
  targetName: z.string(),
  targetStatus: z.string(),
  timeAgo: z.string(),
});

const _candidateDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  patronymic: z.string(),
  city: z.string(),
  experience: z.string(),
  matchScore: z.number(),
  salaryExpectation: z.number(),
  tags: z.array(z.string()),
  currentPosition: z.object({
    company: z.string(),
    position: z.string(),
  }),
  skills: z.array(z.string()),
  languages: z.array(
    z.object({
      name: z.string(),
      level: z.string(),
    }),
  ),
  contacts: z.object({
    phone: z.string(),
    telegram: z.string(),
    email: z.string(),
  }),
  otherVacancies: z.array(z.string()),
  workExperience: z.array(WorkExperience),
  education: z.array(Education),
  resumeFile: z.object({
    name: z.string(),
    size: z.string(),
    url: z.string(),
  }),
  notes: z.array(Note),
  activities: z.array(Activity),
});

export const candidatesRouter = createTRPCRouter({
  getAllCandidates: publicProcedure.query(async () => {
    // Mock data for candidates based on the image
    const candidates = [
      {
        id: "1",
        name: "Якупов Алмас",
        patronymic: "Алчинович",
        city: "Ташкент",
        stage: "offer" as const,
        otherResponses: ["Graphic Designer Middle", "Product Designer"],
        createdAt: "24/09/2025",
        source: "hh.uz",
      },
      {
        id: "2",
        name: "Якупов Алмас",
        patronymic: "Алчинович",
        city: "Ташкент",
        stage: "offer" as const,
        otherResponses: [],
        createdAt: "24/09/2025",
        source: "hh.uz",
      },
      {
        id: "3",
        name: "Нурматов Тургунбек",
        patronymic: "Султанович",
        city: "Самарканд",
        stage: "interview" as const,
        otherResponses: [],
        createdAt: "24/09/2025",
        source: "hh.uz",
      },
      {
        id: "4",
        name: "Абдурахманов Шерзодбек",
        patronymic: "Тохирович",
        city: "Бухара",
        stage: "hired" as const,
        otherResponses: [],
        createdAt: "24/09/2025",
        source: "hh.uz",
      },
    ];

    return candidates;
  }),

  getCandidateById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      // Mock data for candidate details based on the image
      const candidateDetails = {
        id: input.id,
        name: "Якупов Алмас Алчинович",
        location: "ТАШКЕНТ",
        experience: "СТАЖ 5+ ЛЕТ",
        matchScore: 92,
        salaryExpectation: 4000,
        tags: ["ENGLISH C1", "SENIOR", "ВОЗРАСТ 25+"],
        currentPosition: {
          company: "ООО Interstellar group",
          position: "Junior",
        },
        languages: [{ name: "Русский", level: "A1" }],
        skills: ["React"],
        contacts: {
          phone: "+99899 123 45 67",
          telegram: "@yasminayak",
          email: "yasminerim@gmail.com",
        },
        otherVacancies: ["Graphic Designer Middle", "Product Designer"],
        workExperience: [
          {
            company: "Tech Solutions Inc.",
            position: "NETWORK ENGINEER",
            period: "ЯНВАРЬ 2024 - СЕЙЧАС",
            isCurrent: true,
            description: [
              "Мы занимаемся разработкой и поддержкой веб-приложений, активно участвуем в командных проектах",
              "Тщательная отладка кода, чтобы обеспечить высокое качество и надежность программного обеспечения.",
            ],
          },
          {
            company: "Globex International",
            position: "SENIOR SYSTEMS ARCHITECT",
            period: "ФЕВРАЛЬ 2022 - ЯНВАРЬ 2023",
            isCurrent: false,
            description: [
              "Участвую в проектировании и развертывании облачных инфраструктур, обеспечивая их масштабируемость и безопасность.",
              "Занимаюсь автоматизацией процессов разработки и внедрения, используя современные инструменты и практики DevOps.",
            ],
          },
        ],
        education: [
          {
            institution: "Inha University in Tashkent",
            gpa: "GPA 4.5",
            period: "ЯНВАРЬ 2025 - СЕЙЧАС",
            isCurrent: true,
          },
          {
            institution: "Inha University in Tashkent",
            gpa: "GPA 4.5",
            period: "ЯНВАРЬ 2024 - СЕЙЧАС",
            isCurrent: true,
          },
        ],
        resumeFile: {
          name: "yakupovalmas.pdf",
          size: "12MB",
          url: "/api/resume/yakupovalmas.pdf",
        },
        notes: [
          {
            id: "1",
            content: "Оставьте заметку...",
            author: "Эльвира Ахметова",
            createdAt: "2024-01-15",
          },
          {
            id: "2",
            content:
              "Этот кандидат не имеет международных сертификатов, но знает испанский и французский языки",
            author: "Эльвира Ахметова",
            createdAt: "2024-01-14",
          },
        ],
        activities: [
          {
            id: "1",
            userName: "Эльвира Ахметова",
            userAvatar:
              "https://api.dicebear.com/7.x/avataaars/svg?seed=Elvira",
            action: "Изменил(а) статус кандидата",
            targetName: "Ахмедова А. А",
            targetStatus: "Нанят",
            timeAgo: "Только что",
          },
          {
            id: "2",
            userName: "Анна Иванова",
            userAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Anna",
            action: "Изменил(а) статус кандидата",
            targetName: "Мамасаидов М. М",
            targetStatus: "Архивирован",
            timeAgo: "1 день назад",
          },
        ],
      };

      return candidateDetails;
    }),

  createCandidate: publicProcedure
    .input(
      z.object({
        fullName: z.string().min(1, "Ф.И.О обязательно"),
        city: z.string().min(1, "Город обязателен"),
        contacts: z
          .array(
            z.object({
              type: z.string().min(1),
              value: z.string(),
            }),
          )
          .default([]),
        source: z.string().optional(),
        salaryExpectation: z.number().min(0).optional(),
        salaryCurrency: z.enum(["UZS", "USD"]).default("UZS"),
        currentPosition: z.string().optional(),
        skills: z.array(z.string()).default([]),
        languages: z
          .array(
            z.object({
              name: z.string(),
              level: z.string(),
            }),
          )
          .default([]),
        status: z.string().default("new"),
        resumeUrl: z.string().optional(),
        resumeFileName: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Validate incoming values against lookup tables so the frontend can be fully backend-driven.
      const [
        allowedContactTypes,
        allowedSources,
        allowedPositions,
        allowedSkills,
        allowedLanguageLabels,
        allowedLanguageLevels,
        allowedStatuses,
      ] = await Promise.all([
        ctx.db
          .select({ value: candidateContactTypes.value })
          .from(candidateContactTypes)
          .where(eq(candidateContactTypes.isActive, true)),
        ctx.db
          .select({ value: candidateSources.value })
          .from(candidateSources)
          .where(eq(candidateSources.isActive, true)),
        ctx.db
          .select({ value: candidatePositions.value })
          .from(candidatePositions)
          .where(eq(candidatePositions.isActive, true)),
        ctx.db
          .select({ value: candidateSkills.value })
          .from(candidateSkills)
          .where(eq(candidateSkills.isActive, true)),
        ctx.db
          .select({ label: candidateLanguages.label })
          .from(candidateLanguages)
          .where(eq(candidateLanguages.isActive, true)),
        ctx.db
          .select({ value: candidateLanguageLevels.value })
          .from(candidateLanguageLevels)
          .where(eq(candidateLanguageLevels.isActive, true)),
        ctx.db
          .select({ value: candidateStatusOptions.value })
          .from(candidateStatusOptions)
          .where(eq(candidateStatusOptions.isActive, true)),
      ]);

      const contactTypeSet = new Set(allowedContactTypes.map((r) => r.value));
      const sourceSet = new Set(allowedSources.map((r) => r.value));
      const positionSet = new Set(allowedPositions.map((r) => r.value));
      const skillSet = new Set(allowedSkills.map((r) => r.value));
      const languageLabelSet = new Set(
        allowedLanguageLabels.map((r) => r.label),
      );
      const languageLevelSet = new Set(
        allowedLanguageLevels.map((r) => r.value),
      );
      const statusSet = new Set(allowedStatuses.map((r) => r.value));

      for (const c of input.contacts) {
        if (!contactTypeSet.has(c.type)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Unknown contact type: ${c.type}`,
          });
        }
      }

      if (input.source && !sourceSet.has(input.source)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Unknown source: ${input.source}`,
        });
      }

      if (input.currentPosition && !positionSet.has(input.currentPosition)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Unknown position: ${input.currentPosition}`,
        });
      }

      for (const s of input.skills) {
        if (!skillSet.has(s)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Unknown skill: ${s}`,
          });
        }
      }

      for (const l of input.languages) {
        if (!languageLabelSet.has(l.name)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Unknown language: ${l.name}`,
          });
        }
        if (!languageLevelSet.has(l.level)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Unknown language level: ${l.level}`,
          });
        }
      }

      if (!statusSet.has(input.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Unknown status: ${input.status}`,
        });
      }

      const newCandidate = await ctx.db
        .insert(candidates)
        .values({
          fullName: input.fullName,
          city: input.city,
          contacts: input.contacts,
          source: input.source ?? null,
          salaryExpectation: input.salaryExpectation ?? null,
          salaryCurrency: input.salaryCurrency,
          currentPosition: input.currentPosition ?? null,
          skills: input.skills,
          languages: input.languages,
          status: input.status,
          resumeUrl: input.resumeUrl ?? null,
          resumeFileName: input.resumeFileName ?? null,
        })
        .returning();

      return newCandidate[0];
    }),
});
