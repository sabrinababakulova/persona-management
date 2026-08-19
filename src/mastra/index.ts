import { Mastra } from "@mastra/core/mastra";
import { PostgresStore } from "@mastra/pg";

import { env } from "~/env";

import { candidateResumeAnalyzerAgent } from "./agents/candidate-resume-analyzer";
import { candidateResumeClassifierAgent } from "./agents/candidate-resume-classifier";
import { candidateResumeSummaryAgent } from "./agents/candidate-resume-summary";
import { candidateVacancyMatchAgent } from "./agents/candidate-vacancy-match";
import { hrAssistantAgent } from "./agents/hr-assistant";
import { textParaphraserAgent } from "./agents/text-paraphraser";

export const mastra = new Mastra({
  storage: new PostgresStore({
    id: "persona-management",
    connectionString: env.DATABASE_URL,
    schemaName: "mastra",
    max: 5,
  }),
  agents: {
    hrAssistant: hrAssistantAgent,
    candidateResumeAnalyzer: candidateResumeAnalyzerAgent,
    candidateResumeClassifier: candidateResumeClassifierAgent,
    candidateResumeSummary: candidateResumeSummaryAgent,
    candidateVacancyMatch: candidateVacancyMatchAgent,
    textParaphraser: textParaphraserAgent,
  },
});
