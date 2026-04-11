import type { VacancyRowProps } from "~/types/components/vacancy-row-props";
import { FilterIcon, MoreIcon } from "./icons";

export function VacancyRow({
  title,
  subtitle,
  status,
  city,
  responses,
  workType,
}: VacancyRowProps) {
  return (
    <div className="grid grid-cols-12 items-center gap-4 border-border-light border-b px-6 py-4 last:border-b-0">
      <div className="col-span-3">
        <div className="font-medium text-text-heading">{title}</div>
        <div className="text-sm text-text-muted">{subtitle}</div>
      </div>
      <div className="col-span-2">
        <span className="inline-flex rounded-full bg-success-green-bg px-3 py-1 font-medium text-sm text-success-green">
          {status}
        </span>
      </div>
      <div className="col-span-2 text-text-secondary">{city}</div>
      <div className="col-span-2 text-text-secondary">{responses}</div>
      <div className="col-span-2 text-text-secondary">{workType}</div>
      <div className="col-span-1 flex items-center justify-end gap-2">
        <button
          className="flex items-center gap-1 rounded-lg border border-border-light px-3 py-1.5 text-sm text-text-secondary hover:bg-bg-light"
          type="button"
        >
          <FilterIcon className="h-4 w-4" />
          Воронка
        </button>
        <button
          className="p-1.5 text-text-placeholder hover:text-text-secondary"
          type="button"
        >
          <MoreIcon className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
