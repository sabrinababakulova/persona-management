import type { CandidateResumePrefillData } from "~/schemas/resume-analysis";
import type { LookupOption } from "~/types/shared/candidate-lookups";

export type QuickAddCandidatePayload = {
  candidateId: string;
  fullName: string;
  contactType: string;
  contactValue: string;
  status?: string;
  source: string;
  aiAnalysis?: string;
  resumeFileId?: string;
  resumeFileName?: string;
  resumeFileSize?: string;
  resumePrefillData?: CandidateResumePrefillData;
};

export type QuickAddCandidateModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onAddMoreData?: () => void;
  onSaveCandidate?: (payload: QuickAddCandidatePayload) => void;
  isSaving?: boolean;
  errorMessage?: string | null;
  contactTypeOptions?: LookupOption[];
  sourceOptions?: LookupOption[];
  statusOptions?: LookupOption[];
};
