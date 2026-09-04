import type { IconProps } from "./types";

export function FloatingAddIcon({ className, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 40 40"
      {...props}
    >
      <path
        d="M20 10V30M10 20H30"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2.4"
      />
    </svg>
  );
}
