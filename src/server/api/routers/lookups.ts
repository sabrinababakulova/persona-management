import { asc, eq } from "drizzle-orm";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {
  candidateContactTypes,
  candidateLanguageLevels,
  candidateLanguages,
  candidatePositions,
  candidateSkills,
  candidateSources,
  candidateStatusOptions,
  vacancyLevels,
  vacancyStatusOptions,
  vacancyWorkTypes,
} from "~/server/db/schema";

export const lookupsRouter = createTRPCRouter({
  getCandidateCreateOptions: protectedProcedure.query(async ({ ctx }) => {
    const [
      contactTypes,
      sources,
      positions,
      skills,
      languages,
      languageLevels,
      statusOptions,
    ] = await Promise.all([
      ctx.db
        .select({
          value: candidateContactTypes.value,
          label: candidateContactTypes.label,
        })
        .from(candidateContactTypes)
        .where(eq(candidateContactTypes.isActive, true))
        .orderBy(
          asc(candidateContactTypes.sortOrder),
          asc(candidateContactTypes.label),
        ),
      ctx.db
        .select({
          value: candidateSources.value,
          label: candidateSources.label,
        })
        .from(candidateSources)
        .where(eq(candidateSources.isActive, true))
        .orderBy(asc(candidateSources.sortOrder), asc(candidateSources.label)),
      ctx.db
        .select({
          value: candidatePositions.value,
          label: candidatePositions.label,
        })
        .from(candidatePositions)
        .where(eq(candidatePositions.isActive, true))
        .orderBy(
          asc(candidatePositions.sortOrder),
          asc(candidatePositions.label),
        ),
      ctx.db
        .select({
          value: candidateSkills.value,
          label: candidateSkills.label,
        })
        .from(candidateSkills)
        .where(eq(candidateSkills.isActive, true))
        .orderBy(asc(candidateSkills.sortOrder), asc(candidateSkills.label)),
      ctx.db
        .select({
          value: candidateLanguages.value,
          label: candidateLanguages.label,
        })
        .from(candidateLanguages)
        .where(eq(candidateLanguages.isActive, true))
        .orderBy(
          asc(candidateLanguages.sortOrder),
          asc(candidateLanguages.label),
        ),
      ctx.db
        .select({
          value: candidateLanguageLevels.value,
          label: candidateLanguageLevels.label,
        })
        .from(candidateLanguageLevels)
        .where(eq(candidateLanguageLevels.isActive, true))
        .orderBy(
          asc(candidateLanguageLevels.sortOrder),
          asc(candidateLanguageLevels.label),
        ),
      ctx.db
        .select({
          value: candidateStatusOptions.value,
          label: candidateStatusOptions.label,
        })
        .from(candidateStatusOptions)
        .where(eq(candidateStatusOptions.isActive, true))
        .orderBy(
          asc(candidateStatusOptions.sortOrder),
          asc(candidateStatusOptions.label),
        ),
    ]);

    return {
      contactTypes,
      sources,
      positions,
      skills,
      languages,
      languageLevels,
      statusOptions,
    };
  }),

  getVacancyCreateOptions: protectedProcedure.query(async ({ ctx }) => {
    const [levels, workTypes, statusOptions] = await Promise.all([
      ctx.db
        .select({
          value: vacancyLevels.value,
          label: vacancyLevels.label,
        })
        .from(vacancyLevels)
        .where(eq(vacancyLevels.isActive, true))
        .orderBy(asc(vacancyLevels.sortOrder), asc(vacancyLevels.label)),
      ctx.db
        .select({
          value: vacancyWorkTypes.value,
          label: vacancyWorkTypes.label,
        })
        .from(vacancyWorkTypes)
        .where(eq(vacancyWorkTypes.isActive, true))
        .orderBy(asc(vacancyWorkTypes.sortOrder), asc(vacancyWorkTypes.label)),
      ctx.db
        .select({
          value: vacancyStatusOptions.value,
          label: vacancyStatusOptions.label,
        })
        .from(vacancyStatusOptions)
        .where(eq(vacancyStatusOptions.isActive, true))
        .orderBy(
          asc(vacancyStatusOptions.sortOrder),
          asc(vacancyStatusOptions.label),
        ),
    ]);

    return {
      levels,
      workTypes,
      statusOptions,
    };
  }),
});
