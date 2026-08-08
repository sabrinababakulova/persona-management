import type { IconProps } from "./types";

export function CalendarIcon({ className, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M7 3v3m10-3v3M4.75 9.25h14.5M6.5 5h11A2.5 2.5 0 0 1 20 7.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 18.5v-11A2.5 2.5 0 0 1 6.5 5Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2.3"
      />
    </svg>
  );
}
