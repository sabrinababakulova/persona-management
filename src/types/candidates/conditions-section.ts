import type {
  Errors,
  LanguageItem,
  SelectOption,
} from "~/types/candidates/components";

export interface ConditionsSectionProps {
  isOpen: boolean;
  onToggle: () => void;
  errors: Errors;
  salaryExpectation?: number;
  salaryCurrency: "UZS" | "USD";
  onSalaryChange: (value?: number) => void;
  onCurrencyChange: (value: "UZS" | "USD") => void;
  skills: string[];
  skillsOptions: string[];
  onToggleSkill: (skill: string) => void;
  onRemoveSkill: (skill: string) => void;
  languages: LanguageItem[];
  languageOptions: SelectOption[];
  languageLevelOptions: SelectOption[];
  onAddLanguage: () => void;
  onRemoveLanguage: (id: string) => void;
  onLanguageChange: (
    id: string,
    field: "name" | "level",
    value: string,
  ) => void;
}
