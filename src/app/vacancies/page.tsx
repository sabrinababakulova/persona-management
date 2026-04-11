"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api } from "~/trpc/react";
import type { Vacancy } from "~/types/pages/vacancies-page";
import { Checkbox } from "../_components/checkbox";
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
import {
  TablePagination,
  useTablePagination,
} from "../_components/table-pagination";

type VacancyStatus = Vacancy["status"];

const VACANCY_STATUS_OPTIONS: Array<{ value: VacancyStatus; label: string }> = [
  { value: "active", label: "Активна" },
  { value: "draft", label: "Черновик" },
  { value: "paused", label: "Приостановлена" },
  { value: "closed", label: "Закрыта" },
  { value: "archive", label: "Архив" },
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
    containerClassName: "border border-status-outline-border bg-white",
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

export default function VacanciesPage() {
  const utils = api.useUtils();
  const [selectedPeriod, setSelectedPeriod] =
    useState<PeriodFilterValue>("week");
  const vacancyQueryInput = useMemo(
    () => ({ period: selectedPeriod }),
    [selectedPeriod],
  );
  const { data: vacanciesData, isLoading } =
    api.vacancies.getAllVacancies.useQuery(vacancyQueryInput);
  const { data: hasAnyVacancies = false, isLoading: isAnyVacanciesLoading } =
    api.vacancies.hasVacancies.useQuery();
  const [localVacancies, setLocalVacancies] = useState<Vacancy[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!toastMessage) {
      return;
    }

    const timeout = window.setTimeout(() => setToastMessage(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [toastMessage]);

  const updateVacancyStatus = api.vacancies.updateVacancy.useMutation({
    onMutate: async ({ id, status }) => {
      await utils.vacancies.getAllVacancies.cancel(vacancyQueryInput);

      const previousVacancies =
        utils.vacancies.getAllVacancies.getData(vacancyQueryInput);

      if (status) {
        utils.vacancies.getAllVacancies.setData(
          vacancyQueryInput,
          (existing = []) =>
            existing.map((vacancy) =>
              vacancy.source === "local" && vacancy.id === id
                ? { ...vacancy, status }
                : vacancy,
            ),
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
    vacanciesData?.map((vacancy) => ({
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

  const filteredVacancies = vacancies.filter((vacancy) => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const combinedValue =
      `${vacancy.title} ${vacancy.level} ${vacancy.city} ${vacancy.source}`.toLowerCase();

    return combinedValue.includes(normalizedQuery);
  });
  const {
    currentPage,
    itemsPerPage,
    paginatedItems: paginatedVacancies,
    setCurrentPage,
    setItemsPerPage,
    totalPages,
  } = useTablePagination({
    items: filteredVacancies,
    resetKey: `${searchQuery}:${selectedPeriod}`,
  });

  const hasVacancies = hasAnyVacancies;

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-light">
        <div className="text-gray-600">Загрузка...</div>
      </div>
    );
  }

  return (
    <>
      {toastMessage && (
        <output
          aria-live="polite"
          className="fixed top-6 right-6 z-70 rounded-[10px] bg-text-heading px-4 py-3 text-[14px] text-white shadow-toast"
        >
          {toastMessage}
        </output>
      )}

      <main className="flex-1 overflow-auto">
        <div className="p-4 pb-10 lg:p-8 lg:pb-10">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="font-bold text-2xl text-gray-900 lg:text-3xl">
              Вакансии
            </h1>
            {(hasVacancies || isAnyVacanciesLoading) && (
              <PeriodFilter
                ariaLabel="Фильтр периода вакансий"
                onChange={setSelectedPeriod}
                value={selectedPeriod}
              />
            )}
          </div>

          {hasVacancies ? (
            <>
              <div className="mb-6 flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <SearchIcon className="absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-gray-400" />
                  <input
                    className="w-full rounded-xl border border-border-light bg-white py-3 pr-4 pl-12 text-gray-700 placeholder-gray-400 focus:border-primary-blue focus:outline-none focus:ring-2 focus:ring-primary-blue/20"
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Поиск вакансий"
                    type="text"
                    value={searchQuery}
                  />
                </div>
                <button
                  className="flex items-center justify-center gap-2 rounded-xl border border-border-light bg-white px-4 py-3 text-gray-700 hover:bg-bg-light"
                  type="button"
                >
                  <FilterIcon className="h-5 w-5" />
                  <span>Добавить фильтры</span>
                  <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-gray-200 text-xs">
                    +
                  </span>
                </button>
              </div>

              <div className="overflow-hidden rounded-[8px] border border-border-input bg-white">
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

                {paginatedVacancies.map((vacancy, index) => {
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
                        <span className="inline-flex items-center rounded-full bg-[#fff1f3] px-2.5 py-1 font-semibold text-[#d6336c] text-[11px] leading-none">
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
                        index % 2 === 0 ? "bg-white" : "bg-bg-input"
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
                                <option key={option.value} value={option.value}>
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
                        <button
                          className="flex items-center gap-1 text-[14px] text-primary-blue leading-none hover:text-primary-blue-hover"
                          type="button"
                        >
                          <FunnelIcon className="h-3.5 w-3.5" />
                          <span className="hidden xl:inline">Воронка</span>
                        </button>
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

                {filteredVacancies.length === 0 && (
                  <div className="px-4 py-10 text-center text-[14px] text-text-placeholder">
                    Вакансии не найдены
                  </div>
                )}

                <TablePagination
                  currentPage={currentPage}
                  itemsPerPage={itemsPerPage}
                  onItemsPerPageChange={setItemsPerPage}
                  onPageChange={setCurrentPage}
                  totalItems={filteredVacancies.length}
                  totalPages={totalPages}
                />
              </div>
            </>
          ) : (
            <div className="flex min-h-[60vh] items-center justify-center">
              <div className="flex w-full max-w-[236px] flex-col items-center gap-10">
                <NoVacancies className="h-[190px] w-[236px]" />
                <Link
                  className="flex h-[40px] w-[190px] items-center justify-center rounded-[6px] bg-primary-blue px-3 py-2.5 font-medium text-[16px] text-white leading-none tracking-[-0.32px] transition-colors hover:bg-primary-blue-hover"
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
        className="fixed right-6 bottom-6 z-40 flex h-14 w-14 items-center justify-center rounded-[200px] bg-primary-blue text-white shadow-lg transition-colors hover:bg-primary-blue-hover"
        href="/vacancies/create"
      >
        <FloatingAddIcon className="h-10 w-10" />
      </Link>
    </>
  );
}
