import type { IconProps } from "./types";

export function AIGenerationIcon({ className, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      height="12"
      viewBox="0 0 12 12"
      width="12"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M7.41196 1.2002L8.32709 3.6733L10.8002 4.58843L8.32709 5.50356L7.41196 7.97667L6.49683 5.50356L4.02372 4.58843L6.49683 3.6733L7.41196 1.2002Z"
        fill="var(--color-ai-violet)"
      />
      <path
        d="M3.17667 6.84725L3.97608 8.02431L5.15314 8.82373L3.97608 9.62314L3.17667 10.8002L2.37725 9.62314L1.2002 8.82373L2.37725 8.02431L3.17667 6.84725Z"
        fill="var(--color-ai-violet)"
      />
      <path
        d="M7.41196 1.2002L8.32709 3.6733L10.8002 4.58843L8.32709 5.50356L7.41196 7.97667L6.49683 5.50356L4.02372 4.58843L6.49683 3.6733L7.41196 1.2002Z"
        stroke="var(--color-ai-violet)"
        strokeLinejoin="round"
      />
      <path
        d="M3.17667 6.84725L3.97608 8.02431L5.15314 8.82373L3.97608 9.62314L3.17667 10.8002L2.37725 9.62314L1.2002 8.82373L2.37725 8.02431L3.17667 6.84725Z"
        stroke="var(--color-ai-violet)"
        strokeLinejoin="round"
      />
    </svg>
  );
}
