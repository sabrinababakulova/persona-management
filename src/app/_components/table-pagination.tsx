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
      <div className="text-[13px] text-text-placeholder">
        {rangeStart}-{rangeEnd} из {totalItems}
      </div>

      <div className="flex items-center gap-2">
        <button
          className="cursor-pointer rounded-[6px] border border-border-input px-3 py-2 text-[14px] text-text-secondary disabled:cursor-not-allowed disabled:opacity-50"
          disabled={currentPage === 1}
          onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
          type="button"
        >
          Назад
        </button>
        <span className="min-w-[72px] text-center text-[14px] text-text-secondary">
          {currentPage} / {totalPages}
        </span>
        <button
          className="cursor-pointer rounded-[6px] border border-border-input px-3 py-2 text-[14px] text-text-secondary disabled:cursor-not-allowed disabled:opacity-50"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
          type="button"
        >
          Вперед
        </button>
      </div>

      <label className="flex items-center gap-3 text-[14px] text-text-secondary">
        <span>Количество</span>
        <div className="relative">
          <select
            className="h-[40px] min-w-[88px] cursor-pointer appearance-none rounded-[6px] border border-border-input bg-bg-light px-3 pr-9 text-[14px] text-text-secondary"
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
