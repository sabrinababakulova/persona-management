import { describe, expect, test } from "bun:test";

import { candidateFormSchema } from "~/schemas/candidate";
import { candidateResumePrefillSchema } from "~/schemas/resume-analysis";
import { candidateCreateInputSchema } from "~/server/api/routers/candidates/schemas";
import {
  CANDIDATE_CONTACT_TYPES,
  CANDIDATE_LANGUAGE_LEVELS,
  CANDIDATE_LANGUAGES,
  CANDIDATE_POSITIONS,
  CANDIDATE_SKILLS,
  CANDIDATE_SOURCES,
  CANDIDATE_STATUS_OPTIONS,
  VACANCY_LEVELS,
} from "~/server/db/seeds/demo/lookup-options";
import {
  EMPTY_LOOKUP_OPTIONS,
  RESUME_NOT_SPECIFIED_PLACEHOLDER,
  toResumePrefillData,
} from "./resume-prefill-helpers";

const lookupOptions = {
  ...EMPTY_LOOKUP_OPTIONS,
  languages: CANDIDATE_LANGUAGES,
  languageLevels: CANDIDATE_LANGUAGE_LEVELS,
};

describe("resume prefill normalization", () => {
  test("keeps languages with written proficiency levels", () => {
    const result = toResumePrefillData(
      {
        languages: [
          { name: "English", level: "Upper-intermediate" },
          { name: "Русский — родной", level: "" },
          { name: "O‘zbek tili", level: "B1" },
        ],
      },
      lookupOptions,
    );

    expect(result.languages).toEqual([
      { name: "english", level: "B2" },
      { name: "russian", level: "C2" },
      { name: "uzbek", level: "B1" },
    ]);
  });

  test("keeps the Russian proficiency wording used in the supplied resume", () => {
    const result = toResumePrefillData(
      {
        languages: [
          { name: "Английский", level: "средний (B1)" },
          { name: "Испанский", level: "средне продвинутый (B2)" },
        ],
      },
      lookupOptions,
    );

    expect(result.languages).toEqual([
      { name: "english", level: "B1" },
      { name: "spanish", level: "B2" },
    ]);
  });

  test("does not put a degree or specialty into GPA", () => {
    const result = toResumePrefillData(
      {
        education: [
          {
            institution: "University",
            gpa: "международные экономические отношения – бакалавриат, IV",
            period: "",
          },
          {
            institution: "Institute",
            gpa: "3.8/4.0",
            period: "2020–2024",
          },
        ],
      },
      lookupOptions,
    );

    expect(result.education).toEqual([
      { institution: "University", gpa: "", period: "" },
      { institution: "Institute", gpa: "3.8/4.0", period: "2020–2024" },
    ]);
  });

  test("turns partial and oversized AI output into a saveable candidate", () => {
    const longValue = "x".repeat(1_200);
    const result = toResumePrefillData(
      {
        fullName: null,
        city: null,
        contacts: [{ type: "email", value: longValue }],
        salaryExpectation: "999999999999 UZS",
        workExperience: [
          {
            company: null,
            position: "Recruiter",
            period: null,
            description: null,
          },
        ],
        education: [{ institution: null, gpa: null, period: "2024" }],
      },
      {
        contactTypes: CANDIDATE_CONTACT_TYPES,
        sources: CANDIDATE_SOURCES,
        positions: CANDIDATE_POSITIONS,
        skills: CANDIDATE_SKILLS,
        languages: CANDIDATE_LANGUAGES,
        languageLevels: CANDIDATE_LANGUAGE_LEVELS,
        statusOptions: CANDIDATE_STATUS_OPTIONS,
        vacancyLevels: VACANCY_LEVELS,
      },
    );

    expect(result.fullName).toBe(RESUME_NOT_SPECIFIED_PLACEHOLDER);
    expect(result.city).toBe(RESUME_NOT_SPECIFIED_PLACEHOLDER);
    expect(result.contacts[0]?.value).toHaveLength(255);
    expect(result.salaryExpectation).toBe(1_000_000_000);
    expect(result.workExperience).toEqual([
      {
        company: RESUME_NOT_SPECIFIED_PLACEHOLDER,
        position: "Recruiter",
        period: RESUME_NOT_SPECIFIED_PLACEHOLDER,
        description: [RESUME_NOT_SPECIFIED_PLACEHOLDER],
      },
    ]);
    expect(result.education).toEqual([
      {
        institution: RESUME_NOT_SPECIFIED_PLACEHOLDER,
        gpa: "",
        period: "2024",
      },
    ]);

    const createInput = candidateCreateInputSchema.safeParse({
      ...result,
      source: result.source || undefined,
      currentPosition: result.currentPosition || undefined,
      status: result.status || "new",
    });
    expect(createInput.success).toBe(true);
    expect(candidateFormSchema.safeParse(createInput.data).success).toBe(true);
  });

  test("accepts common null and string-number variants from the model", () => {
    expect(
      candidateResumePrefillSchema.safeParse({
        fullName: null,
        city: null,
        contacts: null,
        source: null,
        salaryExpectation: "25000000 UZS",
        salaryCurrency: null,
        vacancyLevel: null,
        currentPosition: null,
        skills: null,
        languages: null,
        workExperience: [
          {
            company: null,
            position: "Recruiter",
            period: null,
            description: "Hiring\nOnboarding",
          },
        ],
        education: null,
        status: null,
      }).success,
    ).toBe(true);
  });
});
