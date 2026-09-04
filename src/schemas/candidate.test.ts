import { describe, expect, test } from "bun:test";

import { candidateFormSchema } from "./candidate";

describe("candidate form validation", () => {
  test("allows an education entry without a GPA", () => {
    const result = candidateFormSchema.safeParse({
      fullName: "Test Candidate",
      city: "Tashkent",
      education: [
        {
          institution: "University",
          gpa: "",
          period: "2020–2024",
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  test("reports an overlong GPA as a readable field error", () => {
    const result = candidateFormSchema.safeParse({
      fullName: "Test Candidate",
      city: "Tashkent",
      education: [
        {
          institution: "University",
          gpa: "x".repeat(201),
          period: "2020–2024",
        },
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]).toMatchObject({
        path: ["education", 0, "gpa"],
        message: "GPA или оценка не должны превышать 200 символов",
      });
    }
  });
});
