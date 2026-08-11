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
    <div className="flex flex-col gap-1.5">
      <div className="flex w-full flex-col gap-1.5">
        <label
          className={`w-full font-semibold text-sm text-text-label leading-5 ${hideLabel ? "sr-only" : ""}`}
          htmlFor={inputId}
        >
          {label}
        </label>
        <div
          className={`flex h-11 w-full items-center rounded-xl border border-border-input bg-bg-input transition-[border-color,box-shadow] duration-200 ease-out focus-within:border-primary-blue focus-within:shadow-[0_0_0_3px_rgba(253,55,44,0.14)] hover:border-border-control ${className ?? ""}`}
        >
          <input
            className={`h-full min-w-0 flex-1 border-none bg-transparent px-3.5 text-sm text-text-heading leading-5 placeholder:text-text-placeholder focus:outline-none ${inputClassName ?? ""}`}
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
