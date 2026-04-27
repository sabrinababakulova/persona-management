import type { IconProps } from "./types";

export function DonutChartIcon({ className, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 100 100"
      {...props}
    >
      <title>Channel Statistics Chart</title>
      <circle
        className="stroke-border-light"
        cx="50"
        cy="50"
        fill="none"
        r="40"
        strokeWidth="20"
      />
      <circle
        className="stroke-chart-pink"
        cx="50"
        cy="50"
        fill="none"
        r="40"
        strokeDasharray="62.8 188.4"
        strokeDashoffset="0"
        strokeWidth="20"
      />
      <circle
        className="stroke-chart-purple"
        cx="50"
        cy="50"
        fill="none"
        r="40"
        strokeDasharray="62.8 188.4"
        strokeDashoffset="-62.8"
        strokeWidth="20"
      />
      <circle
        className="stroke-chart-orange"
        cx="50"
        cy="50"
        fill="none"
        r="40"
        strokeDasharray="62.8 188.4"
        strokeDashoffset="-125.6"
        strokeWidth="20"
      />
    </svg>
  );
}
