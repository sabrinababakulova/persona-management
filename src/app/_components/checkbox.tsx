import type { CheckboxProps } from "~/types/components/checkbox-props";
import { CheckIcon } from "./icons";

export function Checkbox({ checked, onChange }: CheckboxProps) {
  return (
    <button
      className={`flex h-5 w-5 items-center justify-center rounded border transition-colors ${
        checked
          ? "border-checkbox-blue bg-checkbox-blue"
          : "border-border-light bg-bg-light hover:border-text-placeholder"
      }`}
      onClick={onChange}
      type="button"
    >
      {checked && <CheckIcon className="h-3.5 w-3.5 text-bg-light" />}
    </button>
  );
}
