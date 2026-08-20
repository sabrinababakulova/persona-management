import { describe, expect, test } from "bun:test";

import {
  formatCandidateForAiMetadataBackfill,
  hasCandidateTags,
  hasCompleteCandidateAiAnalysisTranslations,
} from "./backfill-candidate-ai-metadata";

describe("candidate AI metadata completeness", () => {
  test("recognizes complete translations and non-empty tags", () => {
    expect(
      hasCompleteCandidateAiAnalysisTranslations({
        ru: "Русский анализ",
        en: "English analysis",
        uz: "O'zbekcha tahlil",
      }),
    ).toBe(true);
    expect(hasCandidateTags(["Backend", "PostgreSQL"])).toBe(true);
  });

  test("rejects partial translations and empty tag arrays", () => {
    expect(
      hasCompleteCandidateAiAnalysisTranslations({
        ru: "Русский",
        en: "English",
        uz: " ",
      }),
    ).toBe(false);
    expect(hasCandidateTags([])).toBe(false);
    expect(hasCandidateTags([" "])).toBe(false);
  });

  test("formats stored profile data as an AI source", () => {
    const source = formatCandidateForAiMetadataBackfill({
      fullName: "Anna Karimova",
      city: "Tashkent",
      currentPosition: "Backend Developer",
      experience: 36,
      salaryExpectation: null,
      salaryCurrency: "USD",
      skills: ["Node.js", "PostgreSQL"],
      languages: [{ name: "English", level: "C1" }],
      workExperience: [
        {
          company: "Example",
          position: "Developer",
          period: "2022–2025",
          description: ["Built APIs"],
        },
      ],
      education: [],
      aiAnalysis: null,
    });

    expect(source).toContain("Backend Developer");
    expect(source).toContain("Node.js, PostgreSQL");
    expect(source).toContain("Example: Developer");
  });
});
