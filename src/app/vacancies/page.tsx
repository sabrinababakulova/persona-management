"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api } from "~/trpc/react";
import type { Vacancy } from "~/types/pages/vacancies-page";
import {
  countActiveFilters,
  EMPTY_FILTER_MODAL_FILTERS,
  FilterModal,
  type FilterModalFilters,
} from "../_components/filter-modal";
import {
  FilterIcon,
  FloatingAddIcon,
  NoVacancies,
  SearchIcon,
} from "../_components/icons";
import {
  PeriodFilter,
  type PeriodFilterValue,
} from "../_components/period-filter";
import { TablePagination } from "../_components/table-pagination";
import { useDebouncedValue } from "../_components/use-debounced-value";
import { VacancyTable } from "../_components/vacancy-table";

type VacancyStatus = Vacancy["status"];

function isVacancyStatus(
  value: string,
  statusOptions: Array<{ value: string }>,
): value is VacancyStatus {
  return statusOptions.some((option) => option.value === value);
}

function toVacancyDetailPath(vacancy: Pick<Vacancy, "id" | "source">): string {
  return `/vacancies/${vacancy.id}`;
}

function toVacancyFunnelPath(vacancy: Pick<Vacancy, "id">): string {
  return `/vacancies/funnel/${vacancy.id}`;
}

export default function VacanciesPage() {
  const utils = api.useUtils();
  const [selectedPeriod, setSelectedPeriod] =
    useState<PeriodFilterValue>("year");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebouncedValue(searchQuery.trim(), 300);
  const [localVacancies, setLocalVacancies] = useState<Vacancy[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<FilterModalFilters>(
    EMPTY_FILTER_MODAL_FILTERS,
  );
  const { data: hasAnyVacancies = false, isLoading: isAnyVacanciesLoading } =
    api.vacancies.hasAny.useQuery();
  const { data: vacancyLookups } =
    api.lookups.getVacancyCreateOptions.useQuery();
  const vacancyQueryInput = useMemo(
    () => ({
      period: selectedPeriod,
      search: debouncedSearchQuery || undefined,
      statuses: appliedFilters.statuses,
      city: appliedFilters.city.trim() || undefined,
      sources: appliedFilters.sources,
      limit: itemsPerPage,
      offset: (currentPage - 1) * itemsPerPage,
    }),
    [
      appliedFilters.city,
      appliedFilters.sources,
      appliedFilters.statuses,
      currentPage,
      debouncedSearchQuery,
      itemsPerPage,
      selectedPeriod,
    ],
  );
  const { data: vacanciesData, isLoading } =
    api.vacancies.list.useQuery(vacancyQueryInput);
  const vacancyStatusOptions = vacancyLookups?.statusOptions ?? [];
  const vacancySourceOptions = vacancyLookups?.sourceOptions ?? [];
  const totalItems = vacanciesData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));

  useEffect(() => {
    if (!toastMessage) {
      return;
    }

    const timeout = window.setTimeout(() => setToastMessage(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [toastMessage]);

  useEffect(() => {
    if (!vacanciesData) {
      return;
    }

    setCurrentPage((prev) => Math.min(prev, totalPages));
  }, [totalPages, vacanciesData]);

  const updateVacancyStatus = api.vacancies.update.useMutation({
    onMutate: async ({ id, status }) => {
      await utils.vacancies.list.cancel(vacancyQueryInput);

      const previousVacancies = utils.vacancies.list.getData(vacancyQueryInput);

      if (status) {
        utils.vacancies.list.setData(vacancyQueryInput, (existing) =>
          existing
            ? {
                ...existing,
                items: existing.items.map((vacancy) =>
                  vacancy.source === "local" && vacancy.id === id
                    ? { ...vacancy, status }
                    : vacancy,
                ),
              }
            : existing,
        );
      }

      return { previousVacancies };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousVacancies) {
        utils.vacancies.list.setData(
          vacancyQueryInput,
          context.previousVacancies,
        );
      }
      setToastMessage("Не удалось обновить статус вакансии");
    },
    onSuccess: () => {
      setToastMessage("Статус вакансии обновлен");
    },
    onSettled: () => {
      void utils.vacancies.list.invalidate();
    },
  });

  // Merge server data with local selection state
  const vacancies =
    vacanciesData?.items.map((vacancy) => ({
      ...vacancy,
      selected:
        localVacancies.find((localVacancy) => localVacancy.id === vacancy.id)
          ?.selected ?? false,
    })) ?? [];

  const toggleSelection = (id: string) => {
    setLocalVacancies((prev) => {
      const existing = prev.find((vacancy) => vacancy.id === id);
      if (existing) {
        return prev.map((vacancy) =>
          vacancy.id === id
            ? { ...vacancy, selected: !vacancy.selected }
            : vacancy,
        );
      }
      return [...prev, { id, selected: true } as Vacancy];
    });
  };

  const handleStatusChange = (vacancyId: string, nextStatus: string) => {
    if (!isVacancyStatus(nextStatus, vacancyStatusOptions)) {
      setToastMessage("Выбран неизвестный статус");
      return;
    }

    const currentStatus =
      vacancies.find((vacancy) => vacancy.id === vacancyId)?.status ?? null;

    if (!currentStatus || currentStatus === nextStatus) {
      return;
    }

    updateVacancyStatus.mutate({ id: vacancyId, status: nextStatus });
  };

  const handleApplyFilters = (filters: FilterModalFilters) => {
    setAppliedFilters(filters);
    setCurrentPage(1);
    setIsFilterModalOpen(false);
  };

  const activeFilterCount = countActiveFilters(appliedFilters);

  const showVacanciesTable = hasAnyVacancies || isLoading;

  return (
    <>
      {toastMessage && (
        <output
          aria-live="polite"
          className="fixed top-6 right-6 z-70 rounded-[10px] bg-text-heading px-4 py-3 text-[14px] text-bg-light shadow-toast"
        >
          {toastMessage}
        </output>
      )}

      <FilterModal
        cityOptions={vacancyLookups?.cities}
        initialFilters={appliedFilters}
        isOpen={isFilterModalOpen}
        onApply={handleApplyFilters}
        onClose={() => setIsFilterModalOpen(false)}
        sourceOptions={vacancySourceOptions}
        statusOptions={vacancyStatusOptions}
      />

      <main className="flex h-full flex-1 overflow-auto">
        <div className="flex min-h-full w-full flex-col p-4 pb-10 lg:p-8 lg:pb-10">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="font-bold text-2xl text-text-heading lg:text-3xl">
              Вакансии
            </h1>
            {(showVacanciesTable || isAnyVacanciesLoading) && (
              <PeriodFilter
                ariaLabel="Фильтр периода вакансий"
                onChange={(value) => {
                  setSelectedPeriod(value);
                  setCurrentPage(1);
                }}
                value={selectedPeriod}
              />
            )}
          </div>

          {showVacanciesTable ? (
            <>
              <div className="mb-6 flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <SearchIcon className="absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-text-placeholder" />
                  <input
                    className="w-full rounded-xl border border-border-light bg-bg-light py-3 pr-4 pl-12 text-text-secondary placeholder:text-text-placeholder focus:border-primary-blue focus:outline-none focus:ring-2 focus:ring-primary-blue"
                    onChange={(event) => {
                      setSearchQuery(event.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Поиск вакансий"
                    type="text"
                    value={searchQuery}
                  />
                </div>
                <button
                  className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-text-secondary transition-colors hover:bg-bg-light ${
                    activeFilterCount > 0
                      ? "border-primary-blue bg-primary-blue-light"
                      : "border-border-light bg-bg-light"
                  }`}
                  onClick={() => setIsFilterModalOpen(true)}
                  type="button"
                >
                  <FilterIcon className="h-5 w-5" />
                  <span>Добавить фильтры</span>
                  <span
                    className={`ml-1 flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                      activeFilterCount > 0
                        ? "bg-primary-blue text-bg-light"
                        : "bg-bg-hover text-text-secondary"
                    }`}
                  >
                    {activeFilterCount > 0 ? activeFilterCount : "+"}
                  </span>
                </button>
              </div>

              <VacancyTable
                getDetailPath={toVacancyDetailPath}
                getFunnelPath={toVacancyFunnelPath}
                isLoading={isLoading}
                isStatusPending={(vacancy) =>
                  vacancy.source !== "hh.uz" &&
                  updateVacancyStatus.isPending &&
                  updateVacancyStatus.variables?.id === vacancy.id
                }
                items={vacancies}
                loadingLabel="Загрузка вакансий..."
                onStatusChange={handleStatusChange}
                onToggleSelection={toggleSelection}
                pagination={
                  <TablePagination
                    currentPage={currentPage}
                    itemsPerPage={itemsPerPage}
                    onItemsPerPageChange={(value) => {
                      setItemsPerPage(value);
                      setCurrentPage(1);
                    }}
                    onPageChange={setCurrentPage}
                    totalItems={totalItems}
                    totalPages={totalPages}
                  />
                }
                stripedRows
                vacancyStatusOptions={vacancyStatusOptions}
              />
            </>
          ) : (
            <div className="flex min-h-[60vh] items-center justify-center">
              <div className="flex w-full max-w-[236px] flex-col items-center gap-10">
                <NoVacancies className="h-[190px] w-[236px]" />
                <Link
                  className="flex h-[40px] w-[190px] items-center justify-center rounded-[6px] bg-primary-blue px-3 py-2.5 font-medium text-[16px] text-bg-light leading-none tracking-[-0.32px] transition-colors hover:bg-primary-blue-hover"
                  href="/vacancies/create"
                >
                  Добавить вакансию
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>

      <Link
        aria-label="Создать вакансию"
        className="fixed right-6 bottom-6 z-40 flex h-14 w-14 items-center justify-center rounded-[200px] bg-primary-blue text-bg-light shadow-lg transition-colors hover:bg-primary-blue-hover"
        href="/vacancies/create"
      >
        <FloatingAddIcon className="h-10 w-10" />
      </Link>
    </>
  );
}
