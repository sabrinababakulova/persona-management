export type CandidateFormData = {
  fullName: string;
  city: string;
  contacts: { type: string; value: string }[];
  source?: string;
  salaryExpectation?: number;
  salaryCurrency: "UZS" | "USD";
  currentPosition?: string;
  skills: string[];
  languages: { name: string; level: string }[];
  status: string;
  aiAnalysis?: string;
  resumeFileId?: string;
  resumeFileName?: string;
  resumeFileSize?: string;
};
