import type { CandidateStatus as ServerCandidateStatus } from "~/types/server/candidates";

export type CandidateStatus = ServerCandidateStatus;

export interface Candidate {
  id: string;
  name: string;
  patronymic: string;
  city: string;
  status: CandidateStatus;
  createdAt: string;
  createdAtValue: string;
  source: string;
  selected?: boolean;
}

export type StageBadgeProps = {
  stage: CandidateStatus;
};
