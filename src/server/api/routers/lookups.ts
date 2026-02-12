import { asc, eq } from "drizzle-orm";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import {
  candidateContactTypes,
  candidateLanguageLevels,
  candidateLanguages,
  candidatePositions,
  candidateSkills,
  candidateSources,
  candidateStatusOptions,
} from "~/server/db/schema";
import { DEFAULT_CANDIDATE_LOOKUPS } from "~/shared/candidate-lookups";

const withFallback = <T,>(values: T[], fallback: readonly T[]): T[] =>
  values.length > 0 ? values : [...fallback];

export const lookupsRouter = createTRPCRouter({
  getCandidateCreateOptions: publicProcedure.query(async ({ ctx }) => {
    try {
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
          .orderBy(
            asc(candidateSources.sortOrder),
            asc(candidateSources.label),
          ),
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
        contactTypes: withFallback(
          contactTypes,
          DEFAULT_CANDIDATE_LOOKUPS.contactTypes,
        ),
        sources: withFallback(sources, DEFAULT_CANDIDATE_LOOKUPS.sources),
        positions: withFallback(positions, DEFAULT_CANDIDATE_LOOKUPS.positions),
        skills: withFallback(skills, DEFAULT_CANDIDATE_LOOKUPS.skills),
        languages: withFallback(languages, DEFAULT_CANDIDATE_LOOKUPS.languages),
        languageLevels: withFallback(
          languageLevels,
          DEFAULT_CANDIDATE_LOOKUPS.languageLevels,
        ),
        statusOptions: withFallback(
          statusOptions,
          DEFAULT_CANDIDATE_LOOKUPS.statusOptions,
        ),
      };
    } catch (error) {
      console.error("lookups.getCandidateCreateOptions failed", error);
      return {
        contactTypes: [...DEFAULT_CANDIDATE_LOOKUPS.contactTypes],
        sources: [...DEFAULT_CANDIDATE_LOOKUPS.sources],
        positions: [...DEFAULT_CANDIDATE_LOOKUPS.positions],
        skills: [...DEFAULT_CANDIDATE_LOOKUPS.skills],
        languages: [...DEFAULT_CANDIDATE_LOOKUPS.languages],
        languageLevels: [...DEFAULT_CANDIDATE_LOOKUPS.languageLevels],
        statusOptions: [...DEFAULT_CANDIDATE_LOOKUPS.statusOptions],
      };
    }
  }),
});
