"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { ChevronDownIcon, ChevronRightIcon } from "./icons";

export const DEFAULT_PAGE_SIZE_OPTIONS = [10, 15, 20] as const;

type UseTablePaginationOptions<T> = {
  initialPageSize?: number;
  items: T[];
  resetKey?: string;
};

export function useTablePagination<T>({
  initialPageSize = 10,
  items,
  resetKey,
}: UseTablePaginationOptions<T>) {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(initialPageSize);

  // biome-ignore lint/correctness/useExhaustiveDependencies: resetKey is used to reset the current page
  useEffect(() => {
    setCurrentPage(1);
  }, [resetKey]);

  const totalPages = Math.max(1, Math.ceil(items.length / itemsPerPage));
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return items.slice(startIndex, startIndex + itemsPerPage);
  }, [currentPage, items, itemsPerPage]);

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  return {
    currentPage,
    itemsPerPage,
    paginatedItems,
    setCurrentPage,
    setItemsPerPage,
    totalPages,
  };
}

type TablePaginationProps = {
  currentPage: number;
  itemsPerPage: number;
  onItemsPerPageChange: (value: number) => void;
  onPageChange: (page: number) => void;
  pageSizeOptions?: readonly number[];
  totalItems: number;
  totalPages: number;
};

export function TablePagination({
  currentPage,
  itemsPerPage,
  onItemsPerPageChange,
  onPageChange,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  totalItems,
  totalPages,
}: TablePaginationProps) {
  const t = useTranslations("Components");
  const rangeStart = totalItems > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
  const rangeEnd =
    totalItems > 0 ? Math.min(currentPage * itemsPerPage, totalItems) : 0;

  return (
    <div className="mobile-pagination grid border-border-input border-t sm:flex sm:flex-row sm:items-center sm:justify-between sm:bg-bg-light sm:px-4 sm:py-3">
      <div className="pagination-range text-text-placeholder text-xs">
        {t("paginationRange", {
          start: rangeStart,
          end: rangeEnd,
          total: totalItems,
        })}
      </div>

      <div className="pagination-controls grid items-center sm:flex sm:gap-2">
        <button
          aria-label={t("previous")}
          className="ui-button ui-button-secondary p-0 sm:px-3"
          disabled={currentPage === 1}
          onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
          type="button"
        >
          <ChevronRightIcon className="h-4 w-4 rotate-180 sm:hidden" />
          <span className="hidden sm:inline">{t("previous")}</span>
        </button>
        <span className="pagination-current min-w-12 text-center text-text-secondary text-xs sm:min-w-16 sm:text-sm">
          {currentPage} / {totalPages}
        </span>
        <button
          aria-label={t("next")}
          className="ui-button ui-button-secondary p-0 sm:px-3"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
          type="button"
        >
          <span className="hidden sm:inline">{t("next")}</span>
          <ChevronRightIcon className="h-4 w-4 sm:hidden" />
        </button>
      </div>

      <label className="pagination-size flex items-center gap-3 text-sm text-text-secondary">
        <span className="pagination-size-label">{t("rowsPerPage")}</span>
        <div className="relative">
          <select
            aria-label={t("rowsPerPage")}
            className="h-8 min-w-13.5 cursor-pointer appearance-none rounded-lg border border-border-input bg-bg-light py-0 pr-6 pl-2.5 text-text-secondary text-xs sm:h-9 sm:min-w-20 sm:bg-bg-input sm:px-3 sm:pr-8 sm:text-sm"
            onChange={(event) =>
              onItemsPerPageChange(Number(event.target.value))
            }
            value={itemsPerPage}
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-2.5 h-3 w-3 -translate-y-1/2 text-text-secondary sm:right-3 sm:h-3.5 sm:w-3.5" />
        </div>
      </label>
    </div>
  );
}
