import type { TextareaHTMLAttributes } from "react";

export type TextareaProps = {
  label: string;
  hideLabel?: boolean;
  textareaClassName?: string;
} & TextareaHTMLAttributes<HTMLTextAreaElement>;
