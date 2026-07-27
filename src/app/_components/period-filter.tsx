"use client";

import { useTranslations } from "next-intl";
import { ChevronDownIcon } from "./icons";

export const PERIOD_FILTER_OPTIONS = [
  { value: "day" },
  { value: "week" },
  { value: "month" },
  { value: "year" },
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
  const t = useTranslations("Components");

  return (
    <div className="relative self-start sm:self-auto">
      <select
        aria-label={ariaLabel}
        className="h-10 appearance-none rounded-lg border border-border-light bg-bg-light py-2 pr-9 pl-3.5 font-medium text-sm text-text-secondary outline-none transition-colors hover:border-border-control hover:bg-bg-input focus:border-primary-blue focus:ring-2 focus:ring-primary-blue/20"
        onChange={(event) => onChange(event.target.value as PeriodFilterValue)}
        value={value}
      >
        {PERIOD_FILTER_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {t(`period.${option.value}`)}
          </option>
        ))}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-text-placeholder" />
    </div>
  );
}
