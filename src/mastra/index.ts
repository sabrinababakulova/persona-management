import { Mastra } from "@mastra/core/mastra";

import { candidateResumeAnalyzerAgent } from "./agents/candidate-resume-analyzer";
import { hrAssistantAgent } from "./agents/hr-assistant";

export const mastra = new Mastra({
  agents: {
    hrAssistant: hrAssistantAgent,
    candidateResumeAnalyzer: candidateResumeAnalyzerAgent,
  },
});
