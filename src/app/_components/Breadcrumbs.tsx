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
    <nav
      aria-label="Хлебные крошки"
      className="flex min-w-0 items-center gap-2 text-sm"
    >
      <Link
        className="shrink-0 font-medium text-text-muted hover:text-text-heading"
        href={rootHref}
      >
        {rootLabel}
      </Link>
      <ChevronRightIcon className="h-3 w-3 text-text-disabled" />
      {parent && (
        <>
          <Link
            className="min-w-0 truncate font-medium text-text-muted hover:text-text-heading"
            href={parent.href}
          >
            {parent.label}
          </Link>
          <ChevronRightIcon className="h-3 w-3 text-text-disabled" />
        </>
      )}
      <span className="min-w-0 truncate font-semibold text-primary-blue">
        {label}
      </span>
    </nav>
  );
}
