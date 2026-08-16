import type { LocalizedText } from "~/shared/localized-ai";

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
  workExperience: {
    company: string;
    position: string;
    period: string;
    isCurrent?: boolean;
    description: string[];
  }[];
  education: {
    institution: string;
    gpa: string;
    period: string;
    isCurrent?: boolean;
  }[];
  status: string;
  aiAnalysis?: string;
  aiAnalysisTranslations?: LocalizedText;
  resumeFileId?: string;
  resumeFileName?: string;
  resumeFileSize?: string;
};
