import type { StatsCardProps } from "~/types/components/stats-card-props";

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
    positive: (
      <svg
        aria-hidden="true"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <title>Positive Trend</title>
        <path
          d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
        />
      </svg>
    ),
    negative: (
      <svg
        aria-hidden="true"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <title>Negative Trend</title>
        <path
          d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
        />
      </svg>
    ),
    neutral: (
      <svg
        aria-hidden="true"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <title>Neutral Trend</title>
        <path
          d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
        />
      </svg>
    ),
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
