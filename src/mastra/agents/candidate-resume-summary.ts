import { Agent } from "@mastra/core/agent";

export const candidateResumeSummaryAgent = new Agent({
  id: "candidateResumeSummary",
  name: "Candidate Resume Summary",
  instructions: `
You summarize a candidate resume into a short ATS-ready assessment.
Always answer in Russian.
Use only information present in the resume.
Do not invent facts.
Return one concise paragraph, maximum 100 words.
No markdown, no bullet points, no headings.
`,
  model: "google/gemini-2.5-flash",
});
