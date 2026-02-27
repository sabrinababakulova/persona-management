import { Mastra } from "@mastra/core/mastra";

import { candidateResumeAnalyzerAgent } from "./agents/candidate-resume-analyzer";
import { candidateResumeSummaryAgent } from "./agents/candidate-resume-summary";
import { hrAssistantAgent } from "./agents/hr-assistant";

export const mastra = new Mastra({
  agents: {
    hrAssistant: hrAssistantAgent,
    candidateResumeAnalyzer: candidateResumeAnalyzerAgent,
    candidateResumeSummary: candidateResumeSummaryAgent,
  },
});
