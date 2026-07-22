"use client";

import type { HeaderSummaryProps } from "~/types/candidates/header-summary";
import { Dropdown } from "../../_components/dropdown";

export function HeaderSummary({
  title,
  subtitle,
  status,
  statusOptions,
  onStatusChange,
  progress,
}: HeaderSummaryProps) {
  return (
    <div className="sticky top-16 z-10 bg-bg-canvas/95 pt-4 pb-5 backdrop-blur-lg">
      <div className="max-w-[640px]">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-2">
            <h1 className="page-title">{title}</h1>
            <div className="flex items-center gap-2">
              <span className="font-medium text-lg text-text-secondary">
                {subtitle.position}
              </span>
              <span className="text-text-secondary">|</span>
              <span className="font-medium text-lg text-text-secondary">
                {subtitle.city}
              </span>
            </div>
          </div>

          <Dropdown
            fieldClassName="h-9 px-2 py-2 pr-7 text-sm leading-none"
            hideLabel
            iconClassName="h-2.5 w-2.5 right-2 text-text-placeholder"
            label="Статус"
            onChange={onStatusChange}
            options={statusOptions}
            value={status}
          />
        </div>

        <div className="mt-6 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-primary-blue text-sm">
              {progress.percentage}% заполнено
            </span>
            <span className="text-text-placeholder text-xs">
              {progress.filled} из {progress.total} полей
            </span>
          </div>

          <div className="h-1.5 w-full overflow-hidden rounded-xl bg-border-input">
            <div
              className="h-full rounded-xl bg-primary-blue transition-all duration-300"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>

          {progress.missing.length > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-text-placeholder">Осталось заполнить:</span>
              {progress.missing.map((field, index) => (
                <span className="flex items-center gap-2" key={field}>
                  <span className="font-medium text-accent-red">{field}</span>
                  {index < progress.missing.length - 1 && (
                    <span className="text-text-disabled">|</span>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
