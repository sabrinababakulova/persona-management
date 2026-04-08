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
    <div className="flex flex-col gap-1">
      <div className="flex w-full flex-col gap-2">
        <label
          className={
            hideLabel
              ? "sr-only"
              : "w-full font-medium text-[16px] text-text-label leading-[1.4] tracking-[-0.32px]"
          }
          htmlFor={textareaId}
        >
          {label}
        </label>
        <textarea
          className={`min-h-[96px] w-full resize-none overflow-hidden rounded-[6px] border border-border-input bg-bg-input px-3 py-3 text-[16px] text-text-heading leading-[1.4] tracking-[-0.32px] placeholder:text-text-placeholder focus:border-primary-blue focus:outline-none ${className ?? ""} ${textareaClassName ?? ""}`}
          id={textareaId}
          ref={textareaRef}
          {...props}
        />
      </div>
    </div>
  );
}
