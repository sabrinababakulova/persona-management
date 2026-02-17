import type { LookupOption } from "~/types/shared/candidate-lookups";

export type QuickAddCandidatePayload = {
  fullName: string;
  contactType: string;
  contactValue: string;
  source: string;
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
