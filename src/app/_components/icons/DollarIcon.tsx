import type { IconProps } from "./types";

export function DollarIcon({ className, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      height="14"
      viewBox="0 0 14 14"
      width="14"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M3.50039 5.6V8.05M10.5004 5.6V8.05M2.45039 10.5H11.5504C12.1303 10.5 12.6004 10.0299 12.6004 9.45V4.55C12.6004 3.9701 12.1303 3.5 11.5504 3.5H2.45039C1.87049 3.5 1.40039 3.9701 1.40039 4.55V9.45C1.40039 10.0299 1.87049 10.5 2.45039 10.5ZM8.40039 7C8.40039 7.7732 7.77359 8.4 7.00039 8.4C6.22719 8.4 5.60039 7.7732 5.60039 7C5.60039 6.2268 6.22719 5.6 7.00039 5.6C7.77359 5.6 8.40039 6.2268 8.40039 7Z"
        stroke="#707A8D"
        stroke-linejoin="round"
        stroke-width="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}
