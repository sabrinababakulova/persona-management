import type { CheckboxProps } from "~/types/components/checkbox-props";

export function Checkbox({ checked, onChange }: CheckboxProps) {
  return (
    <button
      className={`flex h-5 w-5 items-center justify-center rounded border transition-colors ${
        checked
          ? "border-checkbox-blue bg-checkbox-blue"
          : "border-gray-300 bg-white hover:border-gray-400"
      }`}
      onClick={onChange}
      type="button"
    >
      {checked && (
        <svg
          aria-hidden="true"
          className="h-3.5 w-3.5 text-white"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            d="M5 13l4 4L19 7"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={3}
          />
        </svg>
      )}
    </button>
  );
}
