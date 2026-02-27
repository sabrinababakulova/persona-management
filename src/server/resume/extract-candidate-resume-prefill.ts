import { mastra } from "~/mastra";
import {
  type CandidateResumePrefillData,
  candidateResumePrefillSchema,
} from "~/schemas/resume-analysis";
import {
  parseSalaryCurrency,
  parseSalaryExpectation,
  toContacts,
  toLanguages,
  toStringArray,
  toStringValue,
} from "~/utils/resume-prefill-helpers";

export type ResumePrefillExtractionStatus = "success" | "no_data" | "failed";

export type ResumePrefillExtractionResult = {
  prefillData: CandidateResumePrefillData;
  status: ResumePrefillExtractionStatus;
  errorMessage?: string;
};

const EMPTY_RESUME_PREFILL: CandidateResumePrefillData = {
  fullName: "",
  city: "",
  contacts: [],
  source: "",
  salaryExpectation: undefined,
  salaryCurrency: "UZS",
  currentPosition: "",
  skills: [],
  languages: [],
  status: "",
};

function toResumePrefillData(rawPayload: unknown): CandidateResumePrefillData {
  const payload =
    rawPayload && typeof rawPayload === "object"
      ? (rawPayload as Record<string, unknown>)
      : {};

  return {
    fullName: toStringValue(payload.fullName),
    city: toStringValue(payload.city),
    contacts: toContacts(payload.contacts).slice(0, 20),
    source: toStringValue(payload.source),
    salaryExpectation: parseSalaryExpectation(payload.salaryExpectation),
    salaryCurrency: parseSalaryCurrency(payload.salaryCurrency),
    currentPosition: toStringValue(payload.currentPosition),
    skills: toStringArray(payload.skills).slice(0, 50),
    languages: toLanguages(payload.languages).slice(0, 20),
    status: toStringValue(payload.status),
  };
}

function hasAnyPrefillData(prefillData: CandidateResumePrefillData) {
  return Boolean(
    prefillData.fullName ||
      prefillData.city ||
      prefillData.contacts.length > 0 ||
      prefillData.source ||
      prefillData.salaryExpectation !== undefined ||
      prefillData.currentPosition ||
      prefillData.skills.length > 0 ||
      prefillData.languages.length > 0 ||
      prefillData.status,
  );
}

export async function extractCandidateResumePrefillData({
  fileBuffer,
  fileName,
}: {
  fileBuffer: Buffer;
  fileName: string;
}): Promise<ResumePrefillExtractionResult> {
  if (
    !process.env.GOOGLE_API_KEY &&
    !process.env.GOOGLE_GENERATIVE_AI_API_KEY
  ) {
    return {
      prefillData: EMPTY_RESUME_PREFILL,
      status: "failed",
      errorMessage:
        "GOOGLE_API_KEY или GOOGLE_GENERATIVE_AI_API_KEY не задан в окружении",
    };
  }

  try {
    const resumeAnalyzerAgent = mastra.getAgent("candidateResumeAnalyzer");
    const prompt = `
Проанализируй PDF-резюме и верни все найденные данные для автозаполнения формы кандидата.
Возвращай только факты из резюме, ничего не выдумывай.
Если можешь извлечь только часть полей — верни только эту часть.

Формат ответа:
- fullName: string
- city: string
- contacts: [{ type: string, value: string }]
- source: string
- salaryExpectation: number | null
- salaryCurrency: "UZS" | "USD"
- currentPosition: string
- skills: string[]
- languages: [{ name: string, level: string }]
- status: string

Если поле отсутствует в резюме:
- string -> ""
- array -> []
- salaryExpectation -> null
- salaryCurrency -> "UZS"
- status -> ""
`;

    const result = await resumeAnalyzerAgent.generate(
      [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: prompt,
            },
            {
              type: "file",
              data: fileBuffer,
              mimeType: "application/pdf",
              filename: fileName,
            },
          ],
        },
      ],
      {
        structuredOutput: {
          schema: candidateResumePrefillSchema,
        },
      },
    );

    if (!result.object || typeof result.object !== "object") {
      return {
        prefillData: EMPTY_RESUME_PREFILL,
        status: "failed",
        errorMessage: "AI вернул пустой или некорректный structured output",
      };
    }

    const prefillData = toResumePrefillData(result.object);
    return {
      prefillData,
      status: hasAnyPrefillData(prefillData) ? "success" : "no_data",
    };
  } catch (error) {
    console.error("Failed to analyze resume with Mastra agent", error);
    return {
      prefillData: EMPTY_RESUME_PREFILL,
      status: "failed",
      errorMessage:
        error instanceof Error
          ? error.message
          : "Не удалось проанализировать резюме",
    };
  }
}
