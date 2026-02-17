export type SelectOption = { value: string; label: string };

export interface ContactItem {
  id: string;
  type: string;
  value: string;
}

export interface LanguageItem {
  id: string;
  name: string;
  level: string;
}

export type ProgressInfo = {
  percentage: number;
  filled: number;
  total: number;
  missing: string[];
};

export type Errors = Record<string, string>;
