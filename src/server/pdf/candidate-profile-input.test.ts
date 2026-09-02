import { describe, expect, test } from "bun:test";

import {
  ASSESSMENT_FIELD_MAX_LENGTH,
  COVER_LETTER_MAX_LENGTH,
  hasRecruiterAssessment,
  parsePersonHuntersCustomization,
} from "./candidate-profile-input";

describe("hasRecruiterAssessment", () => {
  test("requires at least one non-empty recruiter field", () => {
    expect(hasRecruiterAssessment()).toBe(false);
    expect(hasRecruiterAssessment({})).toBe(false);
    expect(hasRecruiterAssessment({ strengths: "   " })).toBe(false);
    expect(hasRecruiterAssessment({ strengths: "Сильная аналитика" })).toBe(
      true,
    );
  });
});

describe("parsePersonHuntersCustomization", () => {
  test("trims request-scoped cover letter and recruiter fields", () => {
    const formData = new FormData();
    formData.set("coverLetter", "  Добрый день  ");
    formData.set("includeAiAnalysis", "true");
    formData.set("assessment.strengths", "  Сильная аналитика  ");

    expect(parsePersonHuntersCustomization(formData)).toEqual({
      ok: true,
      value: {
        coverLetter: "Добрый день",
        includeAiAnalysis: true,
        recruiterAssessment: { strengths: "Сильная аналитика" },
      },
    });
  });

  test("keeps optional fields absent and AI analysis off by default", () => {
    expect(parsePersonHuntersCustomization(new FormData())).toEqual({
      ok: true,
      value: {
        coverLetter: undefined,
        includeAiAnalysis: false,
        recruiterAssessment: {},
      },
    });
  });

  test("rejects oversized recruiter-entered text", () => {
    const coverLetter = new FormData();
    coverLetter.set("coverLetter", "x".repeat(COVER_LETTER_MAX_LENGTH + 1));
    expect(parsePersonHuntersCustomization(coverLetter)).toMatchObject({
      ok: false,
    });

    const assessment = new FormData();
    assessment.set(
      "assessment.developmentAreas",
      "x".repeat(ASSESSMENT_FIELD_MAX_LENGTH + 1),
    );
    expect(parsePersonHuntersCustomization(assessment)).toMatchObject({
      ok: false,
    });
  });
});
