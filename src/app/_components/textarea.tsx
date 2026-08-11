import { useLayoutEffect, useRef } from "react";

import type { TextareaProps } from "~/types/components/textarea-props";

export function Textarea({
  label,
  hideLabel = false,
  textareaClassName,
  className,
  id,
  ...props
}: TextareaProps) {
  const textareaId = id ?? label;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = "0px";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, []);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex w-full flex-col gap-1.5">
        <label
          className={
            hideLabel
              ? "sr-only"
              : "w-full font-semibold text-sm text-text-label leading-5"
          }
          htmlFor={textareaId}
        >
          {label}
        </label>
        <textarea
          className={`min-h-24 w-full resize-none overflow-hidden rounded-xl border border-border-input bg-bg-input px-3.5 py-3 text-sm text-text-heading leading-5 placeholder:text-text-placeholder hover:border-border-control focus:border-primary-blue focus:outline-none ${className ?? ""} ${textareaClassName ?? ""}`}
          id={textareaId}
          ref={textareaRef}
          {...props}
        />
      </div>
    </div>
  );
}
