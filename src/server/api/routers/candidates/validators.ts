import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";

import {
  candidateContactTypes,
  candidateLanguageLevels,
  candidateLanguages,
  candidatePositions,
  candidateSkills,
  candidateSources,
  candidateStatusOptions,
  vacancyLevels,
} from "~/server/db/schema";

type DatabaseClient = typeof import("~/server/db").db;

/** Loads active lookup values used to validate candidate form submissions. */
export async function loadCandidateLookupSets(db: DatabaseClient) {
  const [
    contactTypes,
    sources,
    positions,
    skills,
    languages,
    languageLevels,
    statusOptions,
    vacancyLevelOptions,
  ] = await Promise.all([
    db
      .select({
        value: candidateContactTypes.value,
        label: candidateContactTypes.label,
      })
      .from(candidateContactTypes)
      .where(eq(candidateContactTypes.isActive, true)),
    db
      .select({
        value: candidateSources.value,
        label: candidateSources.label,
      })
      .from(candidateSources)
      .where(eq(candidateSources.isActive, true)),
    db
      .select({
        value: candidatePositions.value,
        label: candidatePositions.label,
      })
      .from(candidatePositions)
      .where(eq(candidatePositions.isActive, true)),
    db
      .select({
        value: candidateSkills.value,
        label: candidateSkills.label,
      })
      .from(candidateSkills)
      .where(eq(candidateSkills.isActive, true)),
    db
      .select({
        value: candidateLanguages.value,
        label: candidateLanguages.label,
      })
      .from(candidateLanguages)
      .where(eq(candidateLanguages.isActive, true)),
    db
      .select({
        value: candidateLanguageLevels.value,
        label: candidateLanguageLevels.label,
      })
      .from(candidateLanguageLevels)
      .where(eq(candidateLanguageLevels.isActive, true)),
    db
      .select({
        value: candidateStatusOptions.value,
        label: candidateStatusOptions.label,
      })
      .from(candidateStatusOptions)
      .where(eq(candidateStatusOptions.isActive, true)),
    db
      .select({
        value: vacancyLevels.value,
        label: vacancyLevels.label,
      })
      .from(vacancyLevels)
      .where(eq(vacancyLevels.isActive, true)),
  ]);

  return {
    contactTypes,
    sources,
    positions,
    skills,
    languages,
    languageLevels,
    statusOptions,
    vacancyLevelOptions,
  };
}

/**
 * Verifies candidate enum-like fields against active lookup tables.
 *
 * Throws `BAD_REQUEST` for unknown values so invalid client state is rejected
 * before writing JSON fields to the candidate row.
 */
export async function validateCandidateInput(
  db: DatabaseClient,
  input: {
    contacts: { type: string; value: string }[];
    source?: string;
    currentPosition?: string;
    skills: string[];
    languages: { name: string; level: string }[];
    status: string;
  },
) {
  const lookups = await loadCandidateLookupSets(db);

  const contactTypeSet = new Set(lookups.contactTypes.map((row) => row.value));
  const sourceSet = new Set(lookups.sources.map((row) => row.value));
  const positionSet = new Set(lookups.positions.map((row) => row.value));
  const skillSet = new Set(lookups.skills.map((row) => row.value));
  const languageLabelSet = new Set(lookups.languages.map((row) => row.label));
  const languageLevelSet = new Set(
    lookups.languageLevels.map((row) => row.value),
  );
  const statusSet = new Set(lookups.statusOptions.map((row) => row.value));

  for (const contact of input.contacts) {
    if (!contactTypeSet.has(contact.type)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Unknown contact type: ${contact.type}`,
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

  for (const skill of input.skills) {
    if (!skillSet.has(skill)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Unknown skill: ${skill}`,
      });
    }
  }

  for (const language of input.languages) {
    if (!languageLabelSet.has(language.name)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Unknown language: ${language.name}`,
      });
    }
    if (!languageLevelSet.has(language.level)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Unknown language level: ${language.level}`,
      });
    }
  }

  if (!statusSet.has(input.status)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Unknown status: ${input.status}`,
    });
  }

  return lookups;
}
