"use client";

import { ChevronDownIcon } from "./icons";

export const PERIOD_FILTER_OPTIONS = [
  { label: "1 день", value: "day" },
  { label: "1 неделя", value: "week" },
  { label: "1 месяц", value: "month" },
  { label: "1 год", value: "year" },
] as const;

export type PeriodFilterValue = (typeof PERIOD_FILTER_OPTIONS)[number]["value"];

type PeriodFilterProps = {
  ariaLabel: string;
  onChange: (value: PeriodFilterValue) => void;
  value: PeriodFilterValue;
};

export function PeriodFilter({
  ariaLabel,
  onChange,
  value,
}: PeriodFilterProps) {
  return (
    <div className="relative self-start sm:self-auto">
      <select
        aria-label={ariaLabel}
        className="h-[42px] appearance-none rounded-lg border border-border-light bg-bg-light py-2 pr-10 pl-4 text-[14px] text-text-secondary outline-none transition-colors hover:bg-bg-input focus:border-primary-blue focus:ring-2 focus:ring-primary-blue/20"
        onChange={(event) => onChange(event.target.value as PeriodFilterValue)}
        value={value}
      >
        {PERIOD_FILTER_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-4 h-4 w-4 -translate-y-1/2 text-text-placeholder" />
    </div>
  );
}
