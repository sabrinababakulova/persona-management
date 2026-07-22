"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDownIcon } from "./icons";

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
  const rangeStart = totalItems > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
  const rangeEnd =
    totalItems > 0 ? Math.min(currentPage * itemsPerPage, totalItems) : 0;

  return (
    <div className="flex flex-col gap-3 border-border-input border-t bg-bg-light px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-text-placeholder text-xs">
        {rangeStart}-{rangeEnd} из {totalItems}
      </div>

      <div className="flex items-center gap-2">
        <button
          className="ui-button ui-button-secondary min-h-9 px-3"
          disabled={currentPage === 1}
          onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
          type="button"
        >
          Назад
        </button>
        <span className="min-w-16 text-center text-sm text-text-secondary">
          {currentPage} / {totalPages}
        </span>
        <button
          className="ui-button ui-button-secondary min-h-9 px-3"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
          type="button"
        >
          Вперед
        </button>
      </div>

      <label className="flex items-center gap-3 text-sm text-text-secondary">
        <span>Количество</span>
        <div className="relative">
          <select
            className="h-9 min-w-20 cursor-pointer appearance-none rounded-lg border border-border-input bg-bg-light px-3 pr-8 text-sm text-text-secondary"
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
          <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-3 h-3.5 w-3.5 -translate-y-1/2 text-text-secondary" />
        </div>
      </label>
    </div>
  );
}
