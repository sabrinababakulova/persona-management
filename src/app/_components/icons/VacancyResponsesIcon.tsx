import type { IconProps } from "./types";

export function VacancyResponsesIcon({ className, ...props }: IconProps) {
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
        d="M5.667 6.333a2.333 2.333 0 1 1 4.666 0 2.333 2.333 0 0 1-4.666 0Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.3"
      />
      <path
        d="M8 1.667v1.666M8 12.667v1.666M12.714 3.286l-1.178 1.178M4.464 11.536l-1.178 1.178M14.333 8h-1.666M3.333 8H1.667M12.714 12.714l-1.178-1.178M4.464 4.464 3.286 3.286"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.3"
      />
    </svg>
  );
}
