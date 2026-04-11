"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api } from "~/trpc/react";
import type { Vacancy } from "~/types/pages/vacancies-page";
import { Checkbox } from "../_components/checkbox";
import {
  countActiveFilters,
  EMPTY_FILTER_MODAL_FILTERS,
  FilterModal,
  type FilterModalFilters,
} from "../_components/filter-modal";
import {
  ChevronDownIcon,
  FilterIcon,
  FloatingAddIcon,
  FunnelIcon,
  MoreIcon,
  NoVacancies,
  SearchIcon,
  SortIcon,
} from "../_components/icons";
import {
  PeriodFilter,
  type PeriodFilterValue,
} from "../_components/period-filter";
import { TablePagination } from "../_components/table-pagination";
import { useDebouncedValue } from "../_components/use-debounced-value";

type VacancyStatus = Vacancy["status"];

const VACANCY_STATUS_OPTIONS: Array<{ value: VacancyStatus; label: string }> = [
  { value: "active", label: "Активна" },
  { value: "draft", label: "Черновик" },
  { value: "paused", label: "Приостановлена" },
  { value: "closed", label: "Закрыта" },
  { value: "archive", label: "Архив" },
];

const VACANCY_SOURCE_OPTIONS = [
  { value: "local", label: "Локальная" },
  { value: "hh.uz", label: "hh.uz" },
];

const vacancyStatusTone: Record<
  VacancyStatus,
  {
    containerClassName: string;
    textClassName: string;
  }
> = {
  active: {
    containerClassName: "bg-status-active-soft",
    textClassName: "text-status-active-strong",
  },
  draft: {
    containerClassName: "bg-status-draft-soft",
    textClassName: "text-text-placeholder",
  },
  paused: {
    containerClassName: "bg-status-neutral-bg",
    textClassName: "text-status-neutral",
  },
  closed: {
    containerClassName: "bg-status-danger-soft",
    textClassName: "text-accent-red",
  },
  archive: {
    containerClassName: "border border-status-outline-border bg-bg-light",
    textClassName: "text-text-placeholder",
  },
};

function isVacancyStatus(value: string): value is VacancyStatus {
  return ["active", "draft", "paused", "closed", "archive"].includes(value);
}

function getVacancyStatusLabel(status: VacancyStatus): string {
  return (
    VACANCY_STATUS_OPTIONS.find((option) => option.value === status)?.label ??
    "Активна"
  );
}

function formatVacancyPublishedAt(value?: string): string | null {
  if (!value) {
    return null;
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parsedDate);
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
    useState<PeriodFilterValue>("week");
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
    api.vacancies.hasVacancies.useQuery();
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
    api.vacancies.getAllVacancies.useQuery(vacancyQueryInput);
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
    setCurrentPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  const updateVacancyStatus = api.vacancies.updateVacancy.useMutation({
    onMutate: async ({ id, status }) => {
      await utils.vacancies.getAllVacancies.cancel(vacancyQueryInput);

      const previousVacancies =
        utils.vacancies.getAllVacancies.getData(vacancyQueryInput);

      if (status) {
        utils.vacancies.getAllVacancies.setData(
          vacancyQueryInput,
          (existing) =>
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
        utils.vacancies.getAllVacancies.setData(
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
      void utils.vacancies.getAllVacancies.invalidate();
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
    if (!isVacancyStatus(nextStatus)) {
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

  const hasVacancies = hasAnyVacancies;
  const showVacanciesTable = hasVacancies || isLoading;

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
        sourceOptions={VACANCY_SOURCE_OPTIONS}
        statusOptions={VACANCY_STATUS_OPTIONS}
      />

      <main className="flex-1 overflow-auto">
        <div className="p-4 pb-10 lg:p-8 lg:pb-10">
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

              <div className="overflow-hidden rounded-[8px] border border-border-input bg-bg-light">
                <div className="hidden grid-cols-12 border-border-input border-b bg-bg-input px-4 py-[14px] lg:grid">
                  <div className="col-span-3 flex items-center gap-1 text-[14px] text-text-placeholder">
                    <span>Название</span>
                    <SortIcon className="h-4 w-4" />
                  </div>
                  <div className="col-span-2 flex items-center gap-1 text-[14px] text-text-placeholder">
                    <span>Статус</span>
                    <SortIcon className="h-4 w-4" />
                  </div>
                  <div className="col-span-2 flex items-center gap-1 text-[14px] text-text-placeholder">
                    <span>Город</span>
                    <SortIcon className="h-4 w-4" />
                  </div>
                  <div className="col-span-2 flex items-center gap-1 text-[14px] text-text-placeholder">
                    <span>Отклики</span>
                    <SortIcon className="h-4 w-4" />
                  </div>
                  <div className="col-span-2 flex items-center gap-1 text-[14px] text-text-placeholder">
                    <span>Тип работы</span>
                    <SortIcon className="h-4 w-4" />
                  </div>
                  <div className="col-span-1" />
                </div>

                {isLoading ? (
                  <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 px-4 py-10 text-text-placeholder">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-border-light border-t-primary-blue" />
                    <div className="text-[14px]">Загрузка вакансий...</div>
                  </div>
                ) : (
                  <>
                    {vacancies.map((vacancy, index) => {
                      const statusTone =
                        vacancyStatusTone[vacancy.status] ??
                        vacancyStatusTone.active;
                      const isHhVacancy = vacancy.source === "hh.uz";
                      const isStatusPending =
                        !isHhVacancy &&
                        updateVacancyStatus.isPending &&
                        updateVacancyStatus.variables?.id === vacancy.id;
                      const publishedAtLabel = formatVacancyPublishedAt(
                        vacancy.publishedAt,
                      );
                      const titleNode =
                        vacancy.source === "local" ? (
                          <Link
                            className="block max-w-[220px] truncate font-medium text-[14px] text-text-heading leading-none hover:text-primary-blue hover:underline lg:max-w-[180px]"
                            href={toVacancyDetailPath(vacancy)}
                            title={vacancy.title}
                          >
                            {vacancy.title}
                          </Link>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center rounded-full bg-status-danger-soft px-2.5 py-1 font-semibold text-[11px] text-accent-red leading-none">
                              hh.uz
                            </span>
                            <Link
                              className="block max-w-[220px] truncate font-medium text-[14px] text-text-heading leading-none hover:text-primary-blue hover:underline lg:max-w-[180px]"
                              href={toVacancyDetailPath(vacancy)}
                              title={vacancy.title}
                            >
                              {vacancy.title}
                            </Link>
                          </div>
                        );

                      return (
                        <div
                          className={`grid grid-cols-12 items-start border-border-input border-b px-4 py-[14px] last:border-b-0 lg:items-center ${
                            index % 2 === 0 ? "bg-bg-light" : "bg-bg-input"
                          }`}
                          key={vacancy.id}
                        >
                          <div className="col-span-12 flex items-start gap-2.5 lg:col-span-3">
                            <Checkbox
                              checked={vacancy.selected || false}
                              onChange={() => toggleSelection(vacancy.id)}
                            />
                            <div className="min-w-0">
                              {titleNode}
                              <div className="mt-1 truncate text-[12px] text-text-placeholder leading-none">
                                {vacancy.level}
                              </div>
                              {publishedAtLabel && (
                                <div className="mt-1 truncate text-[12px] text-text-placeholder leading-none">
                                  Опубликовано: {publishedAtLabel}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="col-span-6 mt-3 lg:col-span-2 lg:mt-0">
                            {isHhVacancy ? (
                              <span
                                className={`inline-flex min-h-[32px] min-w-[124px] items-center rounded-[6px] px-3 font-semibold text-[12px] uppercase leading-none tracking-[-0.24px] ${statusTone.containerClassName} ${statusTone.textClassName}`}
                              >
                                {getVacancyStatusLabel(vacancy.status)}
                              </span>
                            ) : (
                              <div
                                className={`relative inline-flex min-w-[124px] items-center overflow-hidden rounded-[6px] px-1 ${statusTone.containerClassName}`}
                              >
                                <select
                                  aria-label={`Статус вакансии ${vacancy.title}`}
                                  className={`h-[32px] w-full appearance-none bg-transparent px-2 pr-6 text-[12px] uppercase leading-none tracking-[-0.24px] ${statusTone.textClassName} font-semibold disabled:cursor-not-allowed disabled:opacity-70`}
                                  disabled={isStatusPending}
                                  onChange={(event) => {
                                    handleStatusChange(
                                      vacancy.id,
                                      event.target.value,
                                    );
                                  }}
                                  value={vacancy.status}
                                >
                                  {VACANCY_STATUS_OPTIONS.map((option) => (
                                    <option
                                      key={option.value}
                                      value={option.value}
                                    >
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                                <ChevronDownIcon
                                  className={`pointer-events-none absolute right-2 h-3.5 w-3.5 ${statusTone.textClassName}`}
                                />
                              </div>
                            )}
                          </div>

                          <div className="hidden text-[14px] text-text-heading leading-none lg:col-span-2 lg:block">
                            {vacancy.city || "-"}
                          </div>

                          <div className="hidden text-[14px] text-text-heading leading-none lg:col-span-2 lg:block">
                            {vacancy.responses}
                          </div>

                          <div className="hidden text-[14px] text-text-heading leading-none lg:col-span-2 lg:block">
                            {vacancy.workType || "-"}
                          </div>

                          <div className="col-span-6 mt-3 flex items-center justify-end gap-3 lg:col-span-1 lg:mt-0">
                            {isHhVacancy ? (
                              <span className="flex items-center gap-1 text-[14px] text-text-disabled leading-none">
                                <FunnelIcon className="h-3.5 w-3.5" />
                                <span className="hidden xl:inline">
                                  Воронка
                                </span>
                              </span>
                            ) : (
                              <Link
                                className="flex items-center gap-1 text-[14px] text-primary-blue leading-none hover:text-primary-blue-hover"
                                href={toVacancyFunnelPath(vacancy)}
                              >
                                <FunnelIcon className="h-3.5 w-3.5" />
                                <span className="hidden xl:inline">
                                  Воронка
                                </span>
                              </Link>
                            )}
                            <button
                              className="p-1 text-text-placeholder transition-colors hover:text-text-secondary"
                              type="button"
                            >
                              <MoreIcon className="h-4 w-4" />
                            </button>
                          </div>

                          <div className="col-span-12 mt-3 flex flex-wrap gap-4 text-[12px] text-text-placeholder lg:hidden">
                            <span>Город: {vacancy.city || "-"}</span>
                            <span>Отклики: {vacancy.responses}</span>
                            <span>Тип работы: {vacancy.workType || "-"}</span>
                          </div>
                        </div>
                      );
                    })}

                    {vacancies.length === 0 && (
                      <div className="px-4 py-10 text-center text-[14px] text-text-placeholder">
                        Вакансии не найдены
                      </div>
                    )}

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
                  </>
                )}
              </div>
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
