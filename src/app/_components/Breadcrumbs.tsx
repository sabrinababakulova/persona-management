"use client";

import Link from "next/link";
import { ChevronRightIcon } from "./icons";

interface BreadcrumbsProps {
  label: string;
}

export function Breadcrumbs({ label }: BreadcrumbsProps) {
  return (
    <div className="flex items-center gap-2 pt-2">
      <Link
        className="font-medium text-[14px] text-text-disabled tracking-[-0.28px] hover:text-text-placeholder"
        href="/candidates"
      >
        Кандидаты
      </Link>
      <ChevronRightIcon className="h-3 w-3 text-text-disabled" />
      <span className="font-medium text-[14px] text-primary-blue tracking-[-0.28px]">
        {label}
      </span>
    </div>
  );
}
