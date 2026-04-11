import type { IconProps } from "./types";

export function FileOutlineIcon({ className, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      height="24"
      viewBox="0 0 24 24"
      width="24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M9 3.75H14.25L18.75 8.25V18.75C18.75 19.5784 18.0784 20.25 17.25 20.25H6.75C5.92157 20.25 5.25 19.5784 5.25 18.75V5.25C5.25 4.42157 5.92157 3.75 6.75 3.75H9Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <path
        d="M14.25 3.75V8.25H18.75"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <path
        d="M8.625 12H15.375M8.625 15.75H13.125"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}
