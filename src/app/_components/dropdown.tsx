import { ChevronDownIcon } from "~/app/_components/icons";
import type { DropdownProps } from "~/types/components/dropdown-props";

export function Dropdown({
  label,
  options,
  placeholder,
  value,
  onChange,
  id,
  hideLabel = false,
  className,
  fieldClassName,
  iconClassName,
}: DropdownProps) {
  const selectId = id ?? label;

  return (
    <div className={`flex flex-col gap-1 ${className ?? ""}`}>
      <div className="flex w-full flex-col gap-2">
        <label
          className={
            hideLabel
              ? "sr-only"
              : "w-full font-medium text-[16px] text-text-label leading-[1.4] tracking-[-0.32px]"
          }
          htmlFor={selectId}
        >
          {label}
        </label>
        <div className="relative">
          <select
            className={`h-12 w-full appearance-none rounded-[6px] border border-border-input bg-bg-input px-3 pr-10 text-[16px] leading-[1.4] tracking-[-0.32px] focus:border-primary-blue focus:outline-none ${
              value ? "text-text-heading" : "text-text-placeholder"
            } ${fieldClassName ?? ""}`}
            id={selectId}
            onChange={(event) => onChange(event.target.value)}
            value={value}
          >
            {placeholder !== undefined && (
              <option value="">{placeholder}</option>
            )}
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDownIcon
            className={`pointer-events-none absolute top-1/2 right-3 h-6 w-6 -translate-y-1/2 text-[#697077] ${iconClassName ?? ""}`}
          />
        </div>
      </div>
    </div>
  );
}
