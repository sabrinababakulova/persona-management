import type { ProgressInfo, SelectOption } from "~/types/candidates/components";

export interface HeaderSummaryProps {
  title: string;
  subtitle: { position: string; city: string };
  status: string;
  statusOptions: SelectOption[];
  onStatusChange: (value: string) => void;
  progress: ProgressInfo;
}
