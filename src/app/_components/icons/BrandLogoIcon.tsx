import type { IconProps } from "./types";

export function BrandLogoIcon({ className, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <circle cx="24" cy="24" fill="var(--color-icon-blue)" r="24" />
      <path
        d="M14 20 L34 20 L24 32 L34 20"
        stroke="var(--color-white)"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3"
      />
    </svg>
  );
}
