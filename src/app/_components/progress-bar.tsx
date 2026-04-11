import type { ProgressBarProps } from "~/types/components/progress-bar-props";

export function ProgressBar({ label, value, max }: ProgressBarProps) {
  const percentage = (value / max) * 100;
  return (
    <div className="flex items-center gap-4">
      <span className="w-24 text-sm text-text-secondary">{label}</span>
      <div className="flex-1">
        <div className="h-2.5 w-full rounded-full bg-bg-light">
          <div
            className="h-2.5 rounded-full bg-progress-orange transition-all duration-500"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
      <span className="w-8 text-right font-medium text-sm text-text-heading">
        {value}
      </span>
    </div>
  );
}
