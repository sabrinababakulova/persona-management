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
  disabled = false,
}: DropdownProps) {
  const selectId = id ?? label;

  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <div className="flex w-full flex-col gap-1.5">
        <label
          className={
            hideLabel
              ? "sr-only"
              : "w-full font-semibold text-sm text-text-label leading-5"
          }
          htmlFor={selectId}
        >
          {label}
        </label>
        <div className="group relative">
          <select
            className={`h-11 w-full appearance-none rounded-xl border border-border-input bg-bg-input px-3.5 pr-10 text-sm leading-5 transition-[border-color,box-shadow,color] duration-200 ease-out hover:border-border-control focus:border-primary-blue focus:outline-none ${
              value ? "text-text-heading" : "text-text-placeholder"
            } ${fieldClassName ?? ""} ${disabled ? "cursor-not-allowed opacity-70" : ""}`}
            disabled={disabled}
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
            className={`pointer-events-none absolute top-1/2 right-3 h-5 w-5 -translate-y-1/2 text-text-secondary transition-[transform,color] duration-200 ease-out group-focus-within:-rotate-180 group-focus-within:text-primary-blue group-hover:text-text-heading ${iconClassName ?? ""}`}
          />
        </div>
      </div>
    </div>
  );
}
