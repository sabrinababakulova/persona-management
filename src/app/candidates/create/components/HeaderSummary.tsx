"use client";

import { ChevronDownIcon } from "../../../_components/icons";
import type { ProgressInfo, SelectOption } from "./types";

interface HeaderSummaryProps {
  title: string;
  subtitle: { position: string; city: string };
  status: string;
  statusOptions: SelectOption[];
  onStatusChange: (value: string) => void;
  progress: ProgressInfo;
}

export function HeaderSummary({
  title,
  subtitle,
  status,
  statusOptions,
  onStatusChange,
  progress,
}: HeaderSummaryProps) {
  return (
    <div className="sticky top-0 z-10 bg-white pt-4 pb-6">
      <div className="max-w-[640px]">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-2">
            <h1 className="font-bold text-[#1c1c1e] text-[32px] leading-none tracking-[-0.64px]">
              {title}
            </h1>
            <div className="flex items-center gap-2">
              <span className="font-medium text-[#616c81] text-[20px] tracking-[-0.4px]">
                {subtitle.position}
              </span>
              <span className="text-[#616c81]">|</span>
              <span className="font-medium text-[#616c81] text-[20px] tracking-[-0.4px]">
                {subtitle.city}
              </span>
            </div>
          </div>

          <div className="relative">
            <select
              className="appearance-none rounded-md border border-[#e5e9f2] bg-[#fafbfc] px-2 py-2 pr-7 font-medium text-[#707a8d] text-[14px] tracking-[-0.28px] focus:border-primary-blue focus:outline-none"
              onChange={(e) => onStatusChange(e.target.value)}
              value={status}
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-2 h-2.5 w-2.5 -translate-y-1/2 text-[#707a8d]" />
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[14px] text-primary-blue tracking-[-0.28px]">
              {progress.percentage}% заполнено
            </span>
            <span className="text-[#707a8d] text-[12px] tracking-[-0.24px]">
              {progress.filled} из {progress.total} полей
            </span>
          </div>

          <div className="h-1.5 w-full overflow-hidden rounded-[10px] bg-[#e5e9f2]">
            <div
              className="h-full rounded-[10px] bg-primary-blue transition-all duration-300"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>

          {progress.missing.length > 0 && (
            <div className="flex items-center gap-2 text-[14px]">
              <span className="text-[#707a8d] tracking-[-0.28px]">
                Осталось заполнить:
              </span>
              {progress.missing.map((field, index) => (
                <span className="flex items-center gap-2" key={field}>
                  <span className="font-medium text-[#e01d5e] tracking-[-0.28px]">
                    {field}
                  </span>
                  {index < progress.missing.length - 1 && (
                    <span className="text-[#c1c8d4]">|</span>
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
