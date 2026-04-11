import type { IconProps } from "./types";

export function CheckIcon({ className, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      {...props}
    >
      <path
        d="M5 13l4 4L19 7"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={3}
      />
    </svg>
  );
}
