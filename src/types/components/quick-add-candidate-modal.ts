import type { LookupOption } from "~/types/shared/candidate-lookups";

export type QuickAddCandidatePayload = {
  candidateId: string;
  fullName: string;
  contactType: string;
  contactValue: string;
  source: string;
  resumeUrl?: string;
  resumeFileName?: string;
  resumeFileSize?: string;
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
};
