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

Учитывай визуальную структуру PDF:
- если страница многоколоночная, читай каждую колонку отдельно и соблюдай границы разделов
- связывай текст только с ближайшим заголовком в той же колонке; не склеивай соседние колонки

Для workExperience:
- company: название компании
- position: должность
- period: период работы в свободном виде, например "Январь 2021 - Март 2024" или "2020 - 2022"
- description: обязанности/достижения, каждый пункт отдельной строкой массива

Для education:
- institution: учебное заведение
- включай явно указанные MBA-программы, executive education и повышение квалификации
- gpa: только явно указанная академическая оценка (GPA, средний балл, оценка,
  диплом с отличием и аналогичная оценка); иначе ""
- никогда не помещай в gpa степень/квалификацию (например, бакалавриат или магистратура),
  факультет, специальность/направление, название программы, курс обучения или форму обучения
- period: только период обучения или год окончания; если дат нет, верни ""

Для languages:
- обязательно проверь разделы Languages, Language skills, Языки, Знание языков,
  Владение языками и таблицы с уровнями владения
- добавь каждый язык, явно указанный в резюме
- преобразуй текстовые уровни в ближайший допустимый CEFR:
  родной/native/mother tongue/свободно/fluent/proficient -> C2;
  продвинутый/advanced -> C1; выше среднего/upper-intermediate -> B2;
  средний/intermediate -> B1; элементарный/elementary -> A2;
  начальный/basic/beginner -> A1

Перед ответом обязательно сделай контроль полноты по всем страницам и колонкам PDF:
1. пересчитай все строки в разделе языков и проверь, что каждый язык есть в languages
2. найди каждое отдельное учебное заведение/программу и проверь, что оно есть в education
3. найди каждое отдельное место работы и проверь, что оно есть в workExperience
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
