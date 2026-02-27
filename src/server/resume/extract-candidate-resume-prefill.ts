import { mastra } from "~/mastra";
import {
  type CandidateResumePrefillData,
  candidateResumePrefillSchema,
} from "~/schemas/resume-analysis";
import {
  EMPTY_LOOKUP_OPTIONS,
  hasAnyPrefillData,
  type ResumeLookupOptions,
  toLookupOptionsHints,
  toResumePrefillData,
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
  vacancyLevel: "",
  currentPosition: "",
  skills: [],
  languages: [],
  status: "",
};

export async function extractCandidateResumePrefillData({
  fileBuffer,
  fileName,
  lookupOptions = EMPTY_LOOKUP_OPTIONS,
}: {
  fileBuffer: Buffer;
  fileName: string;
  lookupOptions?: ResumeLookupOptions;
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

    const contactTypeHints = toLookupOptionsHints(lookupOptions.contactTypes);
    const sourceHints = toLookupOptionsHints(lookupOptions.sources);
    const positionHints = toLookupOptionsHints(lookupOptions.positions);
    const skillHints = toLookupOptionsHints(lookupOptions.skills);
    const languageHints = toLookupOptionsHints(lookupOptions.languages);
    const languageLevelHints = toLookupOptionsHints(
      lookupOptions.languageLevels,
    );
    const statusHints = toLookupOptionsHints(lookupOptions.statusOptions);
    const vacancyLevelHints = toLookupOptionsHints(lookupOptions.vacancyLevels);

    const prompt = `
Проанализируй PDF-резюме и верни все найденные данные для автозаполнения формы кандидата.
Возвращай только факты из резюме, ничего не выдумывай.
Если можешь извлечь только часть полей — верни только эту часть.

Допустимые значения из базы данных:
- contacts[].type: ${contactTypeHints}
- source: ${sourceHints}
- currentPosition: ${positionHints}
- skills[]: ${skillHints}
- languages[].name: ${languageHints}
- languages[].level: ${languageLevelHints}
- status: ${statusHints}
- vacancyLevel: ${vacancyLevelHints}

Формат ответа:
- fullName: string
- city: string
- contacts: [{ type: string, value: string }]
- source: string
- salaryExpectation: number | null
- salaryCurrency: "UZS" | "USD"
- vacancyLevel: string
- currentPosition: string
- skills: string[]
- languages: [{ name: string, level: string }]
- status: string

Если поле отсутствует в резюме:
- string -> ""
- array -> []
- salaryExpectation -> null
- salaryCurrency -> "UZS"
- vacancyLevel -> ""
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

    const prefillData = toResumePrefillData(result.object, lookupOptions);
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
