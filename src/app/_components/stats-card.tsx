import type { StatsCardProps } from "~/types/components/stats-card-props";
import { TrendDownIcon, TrendUpIcon } from "./icons";

export function StatsCard({
  title,
  value,
  change,
  changeType,
  period,
}: StatsCardProps) {
  const changeColors = {
    positive: "bg-success-green-bg text-success-green",
    negative: "bg-danger-red-bg text-danger-red",
    neutral: "bg-warning-yellow-bg text-warning-yellow",
  };

  const changeIcons = {
    positive: <TrendUpIcon className="h-4 w-4" />,
    negative: <TrendDownIcon className="h-4 w-4" />,
    neutral: <TrendUpIcon className="h-4 w-4" />,
  };

  return (
    <div className="rounded-2xl border border-border-light bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-text-muted">{title}</span>
        <button
          className="text-primary-blue text-sm hover:underline"
          type="button"
        >
          Детали
        </button>
      </div>
      <div className="flex items-end gap-4">
        <span className="font-bold text-5xl text-gray-900">{value}</span>
        {change && changeType && (
          <span
            className={`flex items-center gap-1 rounded-lg px-2 py-1 font-medium text-sm ${changeColors[changeType]}`}
          >
            {changeIcons[changeType]}
            {change}
          </span>
        )}
      </div>
      <span className="text-sm text-text-muted">{period}</span>
    </div>
  );
}
