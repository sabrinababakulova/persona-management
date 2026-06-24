import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "~/server/db";
import { candidates } from "~/server/db/schema";

/**
 * Plain, already-formatted candidate data consumed by both the PDF and DOCX
 * exporters. Decoupled from the Drizzle row so each renderer depends only on
 * display values; nullable/empty fields are omitted from the output.
 */
export type CandidateProfileData = {
  fullName: string;
  /** e.g. "more than 15 years" — rendered after the "Experience:" label. */
  experience: string | null;
  /** e.g. "41 years, born on 5 May 1985"; omitted when unknown. */
  dateOfBirth: string | null;
  languages: { name: string; level: string }[];
  /** Data URL or absolute file path for the candidate photo; omitted if null. */
  photoSrc: string | null;
  education: { period: string; institution: string; gpa: string }[];
  workExperience: {
    period: string;
    company: string;
    position: string;
    description: string[];
  }[];
  /** Free-text summary shown in the "Additional information" row. */
  additionalInfo: string | null;
  /** Pre-formatted salary line, e.g. "from 3500$ NET + KPI". */
  salaryExpectation: string | null;
};

/**
 * Toggleable sections of the resume. A section renders only when it is both
 * selected in {@link ProfileRenderOptions.sections} and has data present.
 */
export const PROFILE_SECTIONS = [
  "experience",
  "dateOfBirth",
  "languages",
  "education",
  "workExperience",
  "additionalInfo",
  "salary",
] as const;

export type ProfileSection = (typeof PROFILE_SECTIONS)[number];

export type ProfileRenderOptions = {
  /** When false, the Person Hunters logo and footer are omitted (custom export). */
  showBranding: boolean;
  /** Sections allowed to render; data still has to be present for each. */
  sections: ProfileSection[];
};

/** The fixed Person Hunters export: branded, every section included. */
export const PERSON_HUNTERS_OPTIONS: ProfileRenderOptions = {
  showBranding: true,
  sections: [...PROFILE_SECTIONS],
};

function isProfileSection(value: string): value is ProfileSection {
  return (PROFILE_SECTIONS as readonly string[]).includes(value);
}

/**
 * Parses a comma-separated `sections` query value into a validated list,
 * **preserving the caller's order** (so the custom template can be reordered via
 * drag-and-drop) and dropping invalid/duplicate entries. A null value (param
 * absent) defaults to every section in canonical order; an explicit empty value
 * yields an empty list.
 */
export function parseSections(raw: string | null): ProfileSection[] {
  if (raw === null) {
    return [...PROFILE_SECTIONS];
  }
  const seen = new Set<ProfileSection>();
  const ordered: ProfileSection[] = [];
  for (const token of raw.split(",").map((value) => value.trim())) {
    if (token && isProfileSection(token) && !seen.has(token)) {
      seen.add(token);
      ordered.push(token);
    }
  }
  return ordered;
}

export class CandidateNotFoundError extends Error {
  constructor(candidateId: string) {
    super(`Candidate ${candidateId} not found`);
    this.name = "CandidateNotFoundError";
  }
}

function formatSalary(
  salaryExpectation: number | null,
  salaryCurrency: string | null,
): string | null {
  if (!salaryExpectation) {
    return null;
  }

  const formatted = new Intl.NumberFormat("ru-RU").format(salaryExpectation);
  return salaryCurrency === "USD" ? `$${formatted}` : `${formatted} UZS`;
}

/**
 * Loads a candidate (scoped to the caller's company) and maps it into the
 * shared {@link CandidateProfileData} shape used by every exporter.
 *
 * @throws {CandidateNotFoundError} when the candidate is absent or belongs to
 * another company.
 */
export async function loadCandidateProfileData(input: {
  candidateId: string;
  companyId: string;
}): Promise<CandidateProfileData> {
  const [candidate] = await db
    .select()
    .from(candidates)
    .where(
      and(
        eq(candidates.id, input.candidateId),
        eq(candidates.companyId, input.companyId),
      ),
    )
    .limit(1);

  if (!candidate) {
    throw new CandidateNotFoundError(input.candidateId);
  }

  return {
    fullName: candidate.fullName,
    experience: candidate.experience,
    // DOB and candidate photo aren't stored on the candidate row yet; the
    // exporters omit whatever is null.
    dateOfBirth: null,
    photoSrc: null,
    languages: candidate.languages ?? [],
    education: (candidate.education ?? []).map((item) => ({
      period: item.period,
      institution: item.institution,
      gpa: item.gpa,
    })),
    workExperience: (candidate.workExperience ?? []).map((job) => ({
      period: job.period,
      company: job.company,
      position: job.position,
      description: job.description ?? [],
    })),
    additionalInfo: candidate.aiAnalysis,
    salaryExpectation: formatSalary(
      candidate.salaryExpectation,
      candidate.salaryCurrency,
    ),
  };
}
