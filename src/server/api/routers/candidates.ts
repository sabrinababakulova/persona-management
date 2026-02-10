import { desc, eq } from "drizzle-orm";
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

export const candidatesRouter = createTRPCRouter({
  getAllCandidates: publicProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select()
      .from(candidates)
      .orderBy(desc(candidates.createdAt));

    return rows.map((c) => {
      const parts = c.fullName.split(" ");
      const name = parts.slice(0, 2).join(" ");
      const patronymic = parts.slice(2).join(" ");

      // Map status to stage for UI compatibility
      const stageMap: Record<string, "offer" | "interview" | "hired"> = {
        offer: "offer",
        interview: "interview",
        hired: "hired",
      };
      const stage = stageMap[c.status ?? ""] ?? ("offer" as const);

      return {
        id: c.id,
        name,
        patronymic,
        city: c.city ?? "",
        stage,
        otherResponses: [] as string[],
        createdAt: c.createdAt
          ? new Date(c.createdAt).toLocaleDateString("ru-RU", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            })
          : "",
        source: c.source ?? "",
      };
    });
  }),

  getCandidateById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(candidates)
        .where(eq(candidates.id, input.id))
        .limit(1);

      const c = rows[0];
      if (!c) {
        return null;
      }

      // Build contacts object from contacts array
      const contactsArr = (c.contacts ?? []) as {
        type: string;
        value: string;
      }[];
      const phone = contactsArr.find((ct) => ct.type === "phone")?.value ?? "";
      const telegram =
        contactsArr.find((ct) => ct.type === "telegram")?.value ?? "";
      const email = contactsArr.find((ct) => ct.type === "email")?.value ?? "";

      return {
        id: c.id,
        name: c.fullName,
        location: (c.city ?? "").toUpperCase(),
        experience: c.experience ?? "",
        matchScore: c.matchScore ?? 0,
        salaryExpectation: c.salaryExpectation ?? 0,
        tags: (c.tags ?? []) as string[],
        currentPosition: {
          company: c.currentPosition ?? "",
          position: c.currentPosition ?? "",
        },
        languages: (c.languages ?? []) as { name: string; level: string }[],
        skills: (c.skills ?? []) as string[],
        contacts: { phone, telegram, email },
        otherVacancies: [] as string[],
        workExperience: (c.workExperience ?? []) as {
          company: string;
          position: string;
          period: string;
          isCurrent?: boolean;
          description: string[];
        }[],
        education: (c.education ?? []) as {
          institution: string;
          gpa: string;
          period: string;
          isCurrent?: boolean;
        }[],
        resumeFile: {
          name: c.resumeFileName ?? "",
          size: c.resumeFileSize ?? "",
          url: c.resumeUrl ?? "",
        },
        notes: (c.notes ?? []) as {
          id: string;
          content: string;
          author: string;
          createdAt: string;
        }[],
        activities: (c.activities ?? []) as {
          id: string;
          userName: string;
          userAvatar: string;
          action: string;
          targetName: string;
          targetStatus: string;
          timeAgo: string;
        }[],
      };
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
      const { TRPCError } = await import("@trpc/server");

      // Validate incoming values against lookup tables
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
