import type { SelectOption } from "~/types/candidates/components";

export type DropdownProps = {
  label: string;
  options: SelectOption[];
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  id?: string;
  hideLabel?: boolean;
  className?: string;
  fieldClassName?: string;
  iconClassName?: string;
  disabled?: boolean;
};
