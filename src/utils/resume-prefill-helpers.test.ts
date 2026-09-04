import { describe, expect, test } from "bun:test";

import {
  CANDIDATE_LANGUAGE_LEVELS,
  CANDIDATE_LANGUAGES,
} from "~/server/db/seeds/demo/lookup-options";
import {
  EMPTY_LOOKUP_OPTIONS,
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
});
