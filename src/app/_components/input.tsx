import type { InputProps } from "~/types/components/input-props";

export function Input({
  label,
  hideLabel = false,
  endAdornment,
  inputClassName,
  endAdornmentClassName,
  className,
  id,
  ...props
}: InputProps) {
  const inputId = id ?? label;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex w-full flex-col gap-2">
        <label
          className={`w-full font-medium text-[16px] text-text-label leading-[1.4] tracking-[-0.32px] ${hideLabel ? "sr-only" : ""}`}
          htmlFor={inputId}
        >
          {label}
        </label>
        <div
          className={`flex h-12 w-full items-center rounded-[6px] border border-border-input bg-bg-input focus-within:border-primary-blue ${className ?? ""}`}
        >
          <input
            className={`h-full min-w-0 flex-1 border-none bg-transparent px-3 text-[16px] text-text-heading leading-[1.4] tracking-[-0.32px] placeholder:text-text-placeholder focus:outline-none ${inputClassName ?? ""}`}
            id={inputId}
            {...props}
          />
          {endAdornment && (
            <div className={`mr-2 shrink-0 ${endAdornmentClassName ?? ""}`}>
              {endAdornment}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
