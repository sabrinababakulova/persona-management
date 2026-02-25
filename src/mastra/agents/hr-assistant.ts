import { Agent } from "@mastra/core/agent";

export const hrAssistantAgent = new Agent({
  id: "hrAssistant",
  name: "HR Assistant",
  instructions: `
You are an assistant for a recruitment ATS system.
Always answer in Russian.
Help with candidate sourcing, vacancy writing, interview prep, and hiring process recommendations.
Keep answers structured, concise, and practical.
`,
  model: "google/gemini-2.5-flash",
});
