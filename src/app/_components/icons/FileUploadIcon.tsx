import type { IconProps } from "./types";

export function FileUploadIcon({ className, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 20 20"
      {...props}
    >
      <path
        d="M6.2 2.5H11.8L15.8 6.5V16.2C15.8 16.92 15.22 17.5 14.5 17.5H6.2C5.48 17.5 4.9 16.92 4.9 16.2V3.8C4.9 3.08 5.48 2.5 6.2 2.5Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.3"
      />
      <path
        d="M11.8 2.5V6.5H15.8"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.3"
      />
      <path
        d="M7.7 10H13.1M7.7 12.8H13.1"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.3"
      />
    </svg>
  );
}
