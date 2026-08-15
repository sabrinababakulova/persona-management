"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { useLookupLocalizer } from "~/i18n/use-localized-lookups";
import { api } from "~/trpc/react";
import type { RouterOutputs } from "~/types/trpc/router-outputs";
import { publishToast } from "~/utils/toast-bus";
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
import { MotionToast } from "../_components/motion-system";
import {
  PeriodFilter,
  type PeriodFilterValue,
} from "../_components/period-filter";
import { TablePagination } from "../_components/table-pagination";
import { useDebouncedValue } from "../_components/use-debounced-value";
import { VacancyTable } from "../_components/vacancy-table";

type Vacancy = RouterOutputs["vacancies"]["list"]["items"][number];
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
  return `/vacancies/${vacancy.id}/funnel`;
}

export default function VacanciesPage() {
  const t = useTranslations("Vacancies");
  const localizeLookups = useLookupLocalizer();
  const utils = api.useUtils();
  const [selectedPeriod, setSelectedPeriod] =
    useState<PeriodFilterValue>("year");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [searchQuery, setSearchQuery] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<FilterModalFilters>(
    EMPTY_FILTER_MODAL_FILTERS,
  );

  const debouncedSearchQuery = useDebouncedValue(searchQuery.trim(), 300);

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
  const vacancyStatusOptions = localizeLookups(
    vacancyLookups?.statusOptions,
    "vacancyStatuses",
  );
  const vacancySourceOptions = localizeLookups(
    vacancyLookups?.sourceOptions,
    "vacancySources",
  );
  const totalItems = vacanciesData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));

  // Local vacancies still render when hh.uz fails, but the list is incomplete.
  // Authentication failures get a stronger, actionable message than outages.
  const hhUnavailableReason = vacanciesData?.hhUnavailableReason ?? null;
  useEffect(() => {
    if (!hhUnavailableReason) {
      return;
    }
    publishToast({
      variant:
        hhUnavailableReason === "authenticationExpired" ? "error" : "warning",
      messageKey:
        hhUnavailableReason === "authenticationExpired"
          ? "hhSessionExpired"
          : "hhUnavailable",
      dedupeKey: "hh-unavailable",
    });
  }, [hhUnavailableReason]);

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
      setToastMessage(t("statusUpdateError"));
    },
    onSuccess: () => {
      setToastMessage(t("statusUpdated"));
    },
    onSettled: () => {
      void utils.vacancies.list.invalidate();
    },
  });

  const handleStatusChange = (vacancyId: string, nextStatus: string) => {
    if (!isVacancyStatus(nextStatus, vacancyStatusOptions)) {
      setToastMessage(t("unknownStatus"));
      return;
    }

    const currentStatus =
      vacanciesData?.items.find((vacancy) => vacancy.id === vacancyId)
        ?.status ?? null;

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

  // Keep the table mounted whenever the user has narrowed results (search, modal filters,
  // or a non-default period) so an empty response shows the inline "not found" state
  // instead of dropping back to the onboarding CTA.
  const hasActiveSearchOrFilters =
    searchQuery.trim().length > 0 ||
    activeFilterCount > 0 ||
    selectedPeriod !== "year";
  const showVacanciesTable =
    (vacanciesData?.items?.length ?? 0) > 0 ||
    isLoading ||
    hasActiveSearchOrFilters;

  return (
    <>
      <MotionToast message={toastMessage} />

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
        <div className="app-page flex min-h-full flex-col">
          <div className="page-header">
            <h1 className="page-title">{t("title")}</h1>
            <PeriodFilter
              ariaLabel={t("periodFilter")}
              onChange={(value) => {
                setSelectedPeriod(value);
                setCurrentPage(1);
              }}
              value={selectedPeriod}
            />
          </div>

          {showVacanciesTable ? (
            <>
              <div className="mb-5 flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <SearchIcon className="absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-text-placeholder" />
                  <input
                    className="ui-search"
                    onChange={(event) => {
                      setSearchQuery(event.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder={t("search")}
                    type="text"
                    value={searchQuery}
                  />
                </div>
                <button
                  className={`ui-button ui-button-secondary ${
                    activeFilterCount > 0
                      ? "border-primary-blue bg-primary-blue-light"
                      : "border-border-light bg-bg-light"
                  }`}
                  onClick={() => setIsFilterModalOpen(true)}
                  type="button"
                >
                  <FilterIcon className="h-5 w-5" />
                  <span>{t("addFilters")}</span>
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
                items={vacanciesData?.items ?? []}
                loadingLabel={t("loading")}
                onStatusChange={handleStatusChange}
                onToggleSelection={() => {}}
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
              <div className="flex w-full max-w-59 flex-col items-center gap-10">
                <NoVacancies className="h-47.5 w-59" />
                <Link
                  className="ui-button ui-button-primary"
                  href="/vacancies/create"
                >
                  {t("add")}
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>

      <Link
        aria-label={t("create")}
        className="mobile-floating-action fixed right-5 bottom-5 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary-blue text-white shadow-toast transition-[background-color,transform] hover:-translate-y-0.5 hover:bg-primary-blue-hover sm:right-6 sm:bottom-6"
        href="/vacancies/create"
      >
        <FloatingAddIcon className="h-10 w-10" />
      </Link>
    </>
  );
}
