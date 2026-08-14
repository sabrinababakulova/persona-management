import type { CheckboxProps } from "~/types/components/checkbox-props";
import { CheckIcon } from "./icons";

export function Checkbox({ ariaLabel, checked, id, onChange }: CheckboxProps) {
  return (
    <label className="inline-flex shrink-0 cursor-pointer">
      <input
        aria-label={ariaLabel}
        checked={checked}
        className="peer sr-only"
        id={id}
        onChange={onChange}
        type="checkbox"
      />
      <span
        className={`flex h-5 w-5 items-center justify-center rounded border transition-[background-color,border-color,box-shadow] duration-200 ease-out peer-focus-visible:ring-2 peer-focus-visible:ring-primary-blue peer-focus-visible:ring-offset-2 ${
          checked
            ? "border-checkbox-blue bg-checkbox-blue"
            : "border-border-light bg-bg-light hover:border-text-placeholder"
        }`}
      >
        {checked && <CheckIcon className="h-3.5 w-3.5 text-bg-light" />}
      </span>
    </label>
  );
}
