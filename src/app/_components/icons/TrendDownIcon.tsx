import type { IconProps } from "./types";

export function TrendDownIcon({ className, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      {...props}
    >
      <title>Negative Trend</title>
      <path
        d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
    </svg>
  );
}
