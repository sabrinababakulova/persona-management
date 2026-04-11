"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { api } from "~/trpc/react";
import { ChevronDownIcon, SearchIcon } from "./icons";

type CandidateSelectorProps = {
  className?: string;
  disabled?: boolean;
  label: string;
  onChange: (value: { id: string; label: string } | null) => void;
  placeholder?: string;
  selectedCandidateId?: string;
  selectedCandidateLabel?: string;
  vacancyId: string;
};

const PAGE_SIZE = 8;
const SEARCH_DEBOUNCE_MS = 300;

export function CandidateSelector({
  className,
  disabled = false,
  label,
  onChange,
  placeholder = "Выберите кандидата",
  selectedCandidateId,
  selectedCandidateLabel,
  vacancyId,
}: CandidateSelectorProps) {
  const selectId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const trimmedQuery = debouncedSearchQuery.trim();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    searchInputRef.current?.focus();

    const handlePointerDown = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeout);
  }, [searchQuery]);

  const searchInput = useMemo(
    () => ({
      vacancyId,
      limit: PAGE_SIZE,
      offset: (currentPage - 1) * PAGE_SIZE,
      query: trimmedQuery,
    }),
    [currentPage, trimmedQuery, vacancyId],
  );

  const { data, isLoading, isFetching } =
    api.vacancies.searchAvailableCandidatesForVacancy.useQuery(searchInput, {
      enabled: isOpen && Boolean(vacancyId),
      placeholderData: (previousData) => previousData,
    });

  const options = data?.items ?? [];
  const totalItems = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const selectedLabel = selectedCandidateLabel?.trim() || placeholder;

  return (
    <div
      className={`flex flex-col gap-1 ${className ?? ""}`}
      ref={containerRef}
    >
      <div className="flex w-full flex-col gap-2">
        <label
          className="w-full font-medium text-[16px] text-text-label leading-[1.4] tracking-[-0.32px]"
          htmlFor={selectId}
        >
          {label}
        </label>

        <div className="relative">
          <button
            aria-controls={`${selectId}-panel`}
            aria-expanded={isOpen}
            className={`flex h-12 w-full items-center justify-between rounded-[6px] border border-border-input bg-bg-input px-3 text-left text-[16px] leading-[1.4] tracking-[-0.32px] transition-colors focus:border-primary-blue focus:outline-none ${selectedCandidateId ? "text-text-heading" : "text-text-placeholder"} ${disabled ? "cursor-not-allowed opacity-70" : ""}`}
            disabled={disabled || !vacancyId}
            id={selectId}
            onClick={() => setIsOpen((current) => !current)}
            type="button"
          >
            <span className="truncate">{selectedLabel}</span>
            <ChevronDownIcon
              className={`h-5 w-5 shrink-0 text-text-placeholder transition-transform ${isOpen ? "rotate-180" : ""}`}
            />
          </button>

          {isOpen && (
            <div
              className="absolute top-[calc(100%+8px)] left-0 z-50 w-full rounded-[8px] border border-border-input bg-bg-light shadow-toast"
              id={`${selectId}-panel`}
            >
              <div className="border-border-input border-b p-3">
                <div className="relative">
                  <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-text-placeholder" />
                  <input
                    className="h-10 w-full rounded-[6px] border border-border-input bg-bg-input py-2 pr-3 pl-10 text-[14px] text-text-heading outline-none transition-colors placeholder:text-text-placeholder focus:border-primary-blue"
                    onChange={(event) => {
                      setSearchQuery(event.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Поиск кандидата"
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                  />
                </div>
              </div>

              <div className="max-h-[280px] overflow-y-auto p-2">
                {isLoading || isFetching ? (
                  <div className="flex min-h-[180px] flex-col items-center justify-center gap-3 text-text-placeholder">
                    <div className="h-7 w-7 animate-spin rounded-full border-2 border-border-light border-t-primary-blue" />
                    <span className="text-[14px]">Загрузка кандидатов...</span>
                  </div>
                ) : options.length > 0 ? (
                  options.map((candidate) => {
                    const optionMeta = [
                      candidate.currentPosition,
                      candidate.city,
                      candidate.source,
                    ]
                      .filter(Boolean)
                      .join(" · ");

                    return (
                      <button
                        className={`flex w-full flex-col items-start gap-1 rounded-[6px] px-3 py-2 text-left transition-colors hover:bg-bg-input ${selectedCandidateId === candidate.id ? "bg-primary-blue-light/60" : ""}`}
                        key={candidate.id}
                        onClick={() => {
                          onChange({
                            id: candidate.id,
                            label: candidate.fullName,
                          });
                          setIsOpen(false);
                        }}
                        type="button"
                      >
                        <span className="text-[14px] text-text-heading leading-[1.3]">
                          {candidate.fullName}
                        </span>
                        {optionMeta ? (
                          <span className="text-[12px] text-text-placeholder leading-[1.3]">
                            {optionMeta}
                          </span>
                        ) : null}
                      </button>
                    );
                  })
                ) : (
                  <div className="flex min-h-[180px] items-center justify-center px-3 text-center text-[14px] text-text-placeholder">
                    Кандидаты не найдены
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-3 border-border-input border-t px-3 py-2">
                <button
                  className="rounded-[6px] px-3 py-2 text-[13px] text-text-heading transition-colors hover:bg-bg-input disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={currentPage <= 1 || isLoading || isFetching}
                  onClick={() =>
                    setCurrentPage((page) => Math.max(1, page - 1))
                  }
                  type="button"
                >
                  Назад
                </button>

                <span className="text-[13px] text-text-placeholder">
                  {totalItems > 0 ? `${currentPage} / ${totalPages}` : "0 / 0"}
                </span>

                <div className="flex items-center gap-2">
                  {selectedCandidateId ? (
                    <button
                      className="rounded-[6px] px-3 py-2 text-[13px] text-text-placeholder transition-colors hover:bg-bg-input"
                      onClick={() => {
                        onChange(null);
                        setSearchQuery("");
                        setCurrentPage(1);
                        setIsOpen(false);
                      }}
                      type="button"
                    >
                      Очистить
                    </button>
                  ) : null}

                  <button
                    className="rounded-[6px] px-3 py-2 text-[13px] text-text-heading transition-colors hover:bg-bg-input disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={
                      currentPage >= totalPages ||
                      totalItems === 0 ||
                      isLoading ||
                      isFetching
                    }
                    onClick={() =>
                      setCurrentPage((page) => Math.min(totalPages, page + 1))
                    }
                    type="button"
                  >
                    Вперед
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
