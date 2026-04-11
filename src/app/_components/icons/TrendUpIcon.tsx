import type { IconProps } from "./types";

export function TrendUpIcon({ className, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      {...props}
    >
      <title>Positive Trend</title>
      <path
        d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
    </svg>
  );
}
