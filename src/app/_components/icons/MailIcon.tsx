import type { IconProps } from "./types";

export function MailIcon({ className, ...props }: IconProps) {
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
        d="M2.40625 3.60756L7 7.40566L11.9219 3.60756M5.6326 7.00035L2.40625 10.5132M11.5937 10.2255L8.36697 7.00035M3.0625 11.0837C2.33763 11.0837 1.75 10.4653 1.75 9.70253V4.29812C1.75 3.53534 2.33763 2.91699 3.0625 2.91699H10.9375C11.6624 2.91699 12.25 3.53534 12.25 4.29812V9.70253C12.25 10.4653 11.6624 11.0837 10.9375 11.0837H3.0625Z"
        stroke="#707A8D"
        stroke-linejoin="round"
        stroke-width="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}
