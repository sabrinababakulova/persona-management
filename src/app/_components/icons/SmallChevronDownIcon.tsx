import type { IconProps } from "./types";

export function SmallChevronDownIcon({ className, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 10 10"
      {...props}
    >
      <path
        d="M2 3.75L5 6.75L8 3.75"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.2"
      />
    </svg>
  );
}
