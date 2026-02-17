import type { ReactNode } from "react";

export type QuickOverviewProps = {
  candidateId: string | null;
  isOpen: boolean;
  onClose: () => void;
};

export type SectionTitleProps = {
  icon: ReactNode;
  title: string;
};
