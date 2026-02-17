import type { InputHTMLAttributes, ReactNode } from "react";

export type InputProps = {
  label: string;
  hideLabel?: boolean;
  endAdornment?: ReactNode;
  inputClassName?: string;
  endAdornmentClassName?: string;
} & InputHTMLAttributes<HTMLInputElement>;
