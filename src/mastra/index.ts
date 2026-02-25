import { Mastra } from "@mastra/core/mastra";

import { hrAssistantAgent } from "./agents/hr-assistant";

export const mastra = new Mastra({
  agents: {
    hrAssistant: hrAssistantAgent,
  },
});
