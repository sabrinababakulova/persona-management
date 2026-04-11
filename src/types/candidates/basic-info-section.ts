import type {
  ContactItem,
  Errors,
  SelectOption,
} from "~/types/candidates/components";

export interface BasicInfoSectionProps {
  isOpen: boolean;
  onToggle: () => void;
  errors: Errors;
  fullName: string;
  city: string;
  currentPosition: string;
  source: string;
  vacancyId?: string;
  selectedVacancyLabel?: string;
  contacts: ContactItem[];
  contactSources: SelectOption[];
  positions: SelectOption[];
  sources: SelectOption[];
  onInputChange: (
    field: "fullName" | "city" | "currentPosition" | "source" | "vacancyId",
    value: string,
  ) => void;
  onVacancyChange: (value: { id: string; label: string } | null) => void;
  onAddContact: () => void;
  onRemoveContact: (id: string) => void;
  onContactChange: (id: string, field: "type" | "value", value: string) => void;
}
