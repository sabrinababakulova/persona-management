import type { IconProps } from "./types";

export function ProfileOutlineIcon({ className, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      height="16"
      viewBox="0 0 16 16"
      width="16"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M8 8.66667C9.47276 8.66667 10.6667 7.47276 10.6667 6C10.6667 4.52724 9.47276 3.33334 8 3.33334C6.52724 3.33334 5.33334 4.52724 5.33334 6C5.33334 7.47276 6.52724 8.66667 8 8.66667Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.4"
      />
      <path
        d="M3.33334 12.6667C3.86065 11.1154 5.82267 10 8.00001 10C10.1773 10 12.1393 11.1154 12.6667 12.6667"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.4"
      />
    </svg>
  );
}
