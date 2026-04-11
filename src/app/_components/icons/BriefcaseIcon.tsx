import type { IconProps } from "./types";

export function BriefcaseIcon({ className, ...props }: IconProps) {
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
        d="M4.92253 4.45221V3.126C4.92253 2.75977 5.23266 2.46289 5.61523 2.46289H8.03971C8.42229 2.46289 8.73242 2.75977 8.73242 3.126V4.45221M2.8444 11.0833H11.1569C11.922 11.0833 12.5423 10.4895 12.5423 9.75705V5.77842C12.5423 5.04597 11.922 4.45221 11.1569 4.45221H2.8444C2.07926 4.45221 1.45898 5.04597 1.45898 5.77842V9.75705C1.45898 10.4895 2.07926 11.0833 2.8444 11.0833Z"
        stroke="var(--color-text-placeholder)"
        strokeLinecap="round"
        strokeWidth="1.3"
      />
    </svg>
  );
}
