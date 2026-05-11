"use client";

import Link from "next/link";
import type { BreadcrumbsProps } from "~/types/components/breadcrumbs-props";
import { ChevronRightIcon } from "./icons";

export function Breadcrumbs({
  label,
  rootLabel = "Кандидаты",
  rootHref = "/candidates",
  parent,
}: BreadcrumbsProps) {
  return (
    <div className="flex items-center gap-2 pt-2">
      <Link
        className="font-medium text-[14px] text-text-disabled tracking-[-0.28px] hover:text-text-placeholder"
        href={rootHref}
      >
        {rootLabel}
      </Link>
      <ChevronRightIcon className="h-3 w-3 text-text-disabled" />
      {parent && (
        <>
          <Link
            className="font-medium text-[14px] text-text-disabled tracking-[-0.28px] hover:text-text-placeholder"
            href={parent.href}
          >
            {parent.label}
          </Link>
          <ChevronRightIcon className="h-3 w-3 text-text-disabled" />
        </>
      )}
      <span className="font-medium text-[14px] text-primary-blue tracking-[-0.28px]">
        {label}
      </span>
    </div>
  );
}
