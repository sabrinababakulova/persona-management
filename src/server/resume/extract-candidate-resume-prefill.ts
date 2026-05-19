import { mastra } from "~/mastra";
import {
  type CandidateResumePrefillData,
  candidateResumePrefillSchema,
} from "~/schemas/resume-analysis";
import { recordAiUsage } from "~/server/ai/usage-logging";
import {
  EMPTY_LOOKUP_OPTIONS,
  hasAnyPrefillData,
  type ResumeLookupOptions,
  toLookupOptionsHints,
  toResumePrefillData,
} from "~/utils/resume-prefill-helpers";

export type ResumePrefillExtractionStatus = "success" | "no_data" | "failed";

type Database = typeof import("~/server/db").db;

type AiUsageContext = {
  db: Database;
  userId?: string | null;
  companyId?: string | null;
  candidateId?: string | null;
};

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
  workExperience: [],
  education: [],
  status: "",
};

export async function extractCandidateResumePrefillData({
  fileBuffer,
  fileName,
  lookupOptions = EMPTY_LOOKUP_OPTIONS,
  usageContext,
}: {
  fileBuffer: Buffer;
  fileName: string;
  lookupOptions?: ResumeLookupOptions;
  usageContext?: AiUsageContext;
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
- salaryExpectation: number | null
- salaryCurrency: "UZS" | "USD"
- vacancyLevel: string
- currentPosition: string
- skills: string[]
- languages: [{ name: string, level: string }]
- workExperience: [{ company: string, position: string, period: string, description: string[] }]
- education: [{ institution: string, gpa: string, period: string }]
- status: string

Если поле отсутствует в резюме:
- string -> ""
- array -> []
- workExperience -> []
- education -> []
- salaryExpectation -> null
- salaryCurrency -> "UZS"
- vacancyLevel -> ""
- status -> ""

Для workExperience:
- company: название компании
- position: должность
- period: период работы в свободном виде, например "Январь 2021 - Март 2024" или "2020 - 2022"
- description: обязанности/достижения, каждый пункт отдельной строкой массива

Для education:
- institution: учебное заведение
- gpa: GPA, оценка, степень или специальность, если указано; иначе ""
- period: период обучения или год окончания
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
      if (usageContext) {
        await recordAiUsage({
          ...usageContext,
          model: "gemini-2.5-flash",
          agent: "candidateResumeAnalyzer",
          operation: "candidate_resume_prefill",
          status: "failed",
          usage: result.totalUsage ?? result.usage,
          errorMessage: "AI вернул пустой или некорректный structured output",
        });
      }

      return {
        prefillData: EMPTY_RESUME_PREFILL,
        status: "failed",
        errorMessage: "AI вернул пустой или некорректный structured output",
      };
    }

    const prefillData = toResumePrefillData(result.object, lookupOptions);
    if (usageContext) {
      await recordAiUsage({
        ...usageContext,
        model: "gemini-2.5-flash",
        agent: "candidateResumeAnalyzer",
        operation: "candidate_resume_prefill",
        status: "success",
        usage: result.totalUsage ?? result.usage,
      });
    }

    return {
      prefillData,
      status: hasAnyPrefillData(prefillData) ? "success" : "no_data",
    };
  } catch (error) {
    console.error("Failed to analyze resume with Mastra agent", error);
    if (usageContext) {
      await recordAiUsage({
        ...usageContext,
        model: "gemini-2.5-flash",
        agent: "candidateResumeAnalyzer",
        operation: "candidate_resume_prefill",
        status: "failed",
        usage: null,
        errorMessage:
          error instanceof Error
            ? error.message
            : "Не удалось проанализировать резюме",
      });
    }

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
