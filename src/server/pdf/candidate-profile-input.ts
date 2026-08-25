export const RECRUITER_ASSESSMENT_FIELDS = [
  "willSucceed",
  "motivators",
  "strengths",
  "willNotSucceed",
  "demotivators",
  "developmentAreas",
] as const;

export type RecruiterAssessmentField =
  (typeof RECRUITER_ASSESSMENT_FIELDS)[number];

export type RecruiterAssessment = Partial<
  Record<RecruiterAssessmentField, string>
>;

export function hasRecruiterAssessment(
  assessment?: RecruiterAssessment,
): boolean {
  return RECRUITER_ASSESSMENT_FIELDS.some((field) =>
    Boolean(assessment?.[field]?.trim()),
  );
}

export const COVER_LETTER_MAX_LENGTH = 8_000;
export const ASSESSMENT_FIELD_MAX_LENGTH = 3_000;

type PersonHuntersCustomization = {
  coverLetter?: string;
  includeAiAnalysis: boolean;
  recruiterAssessment: RecruiterAssessment;
};

export type PersonHuntersCustomizationResult =
  | { ok: true; value: PersonHuntersCustomization }
  | { ok: false; error: string };

function readOptionalText(
  formData: FormData,
  key: string,
  maxLength: number,
): { ok: true; value?: string } | { ok: false; error: string } {
  const raw = formData.get(key);
  if (raw === null) {
    return { ok: true };
  }
  if (typeof raw !== "string") {
    return { ok: false, error: `Поле «${key}» должно содержать текст` };
  }

  const value = raw.trim();
  if (value.length > maxLength) {
    return {
      ok: false,
      error: `Поле «${key}» не должно превышать ${maxLength} символов`,
    };
  }
  return value ? { ok: true, value } : { ok: true };
}

export function parsePersonHuntersCustomization(
  formData: FormData,
): PersonHuntersCustomizationResult {
  const coverLetter = readOptionalText(
    formData,
    "coverLetter",
    COVER_LETTER_MAX_LENGTH,
  );
  if (!coverLetter.ok) {
    return coverLetter;
  }

  const recruiterAssessment: RecruiterAssessment = {};
  for (const field of RECRUITER_ASSESSMENT_FIELDS) {
    const result = readOptionalText(
      formData,
      `assessment.${field}`,
      ASSESSMENT_FIELD_MAX_LENGTH,
    );
    if (!result.ok) {
      return result;
    }
    if (result.value) {
      recruiterAssessment[field] = result.value;
    }
  }

  return {
    ok: true,
    value: {
      coverLetter: coverLetter.value,
      includeAiAnalysis: formData.get("includeAiAnalysis") === "true",
      recruiterAssessment,
    },
  };
}
