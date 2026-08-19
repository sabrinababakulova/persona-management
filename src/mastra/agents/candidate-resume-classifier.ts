import { Agent } from "@mastra/core/agent";

export const candidateResumeClassifierAgent = new Agent({
  id: "candidateResumeClassifier",
  name: "Candidate Resume Classifier",
  instructions: `
You classify whether a supplied PDF is a candidate resume/CV.

Return isResume=true only when the document primarily describes a person's
professional profile for hiring: identity or contact details, skills,
employment history, education, qualifications, or a recognizable combination
of those sections.

Return isResume=false for job descriptions, vacancy advertisements, invoices,
contracts, certificates without a professional profile, portfolios without a
resume, forms, reports, presentations, scans with no readable resume content,
and unrelated documents.

Use only the supplied document. Do not infer missing content from the filename.
Keep reason concise and write it in Russian.
`,
  model: "google/gemini-2.5-flash",
});
