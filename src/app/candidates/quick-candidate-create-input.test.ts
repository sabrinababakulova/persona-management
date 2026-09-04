import { describe, expect, test } from "bun:test";

import type { QuickAddCandidatePayload } from "~/types/components/quick-add-candidate-modal";
import { buildQuickCandidateCreateInput } from "./quick-candidate-create-input";

describe("quick candidate create input", () => {
  test("preserves every candidate field extracted from a resume", () => {
    const payload: QuickAddCandidatePayload = {
      candidateId: "84f64b53-723e-47b2-bbc5-4d9980ad5b7e",
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      contactType: "telegram",
      contactValue: "@ada",
      status: "new",
      source: "local",
      aiAnalysis: "Strong analytical profile",
      aiAnalysisTranslations: {
        ru: "Сильный аналитический профиль",
        en: "Strong analytical profile",
        uz: "Kuchli tahliliy profil",
      },
      tags: ["analytical"],
      resumeFileId: "resume-file-id",
      resumeFileName: "ada.pdf",
      resumeFileSize: "128 KB",
      resumePrefillData: {
        fullName: "Resume name",
        city: "Tashkent",
        contacts: [
          { type: "email", value: "old@example.com" },
          { type: "phone", value: "+998 90 123 45 67" },
        ],
        source: "hh.uz",
        salaryExpectation: 20_000_000,
        salaryCurrency: "UZS",
        vacancyLevel: "senior",
        currentPosition: "software-engineer",
        skills: ["typescript", "sql"],
        languages: [{ name: "English", level: "c1" }],
        workExperience: [
          {
            company: "Analytical Engines",
            position: "Engineer",
            period: "2022–2026",
            description: ["Built computation systems"],
          },
        ],
        education: [
          {
            institution: "University of London",
            gpa: "First class",
            period: "2018–2022",
          },
        ],
        status: "screening",
      },
    };

    const result = buildQuickCandidateCreateInput({
      defaultStatus: "new",
      fallbackCity: "Not specified",
      payload,
    });

    expect(result).toEqual({
      id: payload.candidateId,
      fullName: "Ada Lovelace",
      city: "Tashkent",
      contacts: [
        { type: "email", value: "ada@example.com" },
        { type: "telegram", value: "@ada" },
        { type: "phone", value: "+998 90 123 45 67" },
      ],
      source: "local",
      salaryExpectation: 20_000_000,
      salaryCurrency: "UZS",
      currentPosition: "software-engineer",
      skills: ["typescript", "sql"],
      languages: [{ name: "English", level: "c1" }],
      workExperience: [
        {
          company: "Analytical Engines",
          position: "Engineer",
          period: "2022–2026",
          description: ["Built computation systems"],
        },
      ],
      education: [
        {
          institution: "University of London",
          gpa: "First class",
          period: "2018–2022",
        },
      ],
      status: "new",
      aiAnalysis: "Strong analytical profile",
      aiAnalysisTranslations: payload.aiAnalysisTranslations,
      tags: ["analytical"],
      resumeFileId: "resume-file-id",
      resumeFileName: "ada.pdf",
      resumeFileSize: "128 KB",
    });
  });
});
