"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { useLookupLocalizer } from "~/i18n/use-localized-lookups";
import { api } from "~/trpc/react";
import type { QuickAddCandidatePayload } from "~/types/components/quick-add-candidate-modal";
import type { RouterOutputs } from "~/types/trpc/router-outputs";

type Candidate = RouterOutputs["candidates"]["list"]["items"][number];

import { Checkbox } from "../_components/checkbox";
import { DeleteRowActionMenu } from "../_components/delete-row-action-menu";
import {
  countActiveFilters,
  EMPTY_FILTER_MODAL_FILTERS,
  FilterModal,
  type FilterModalFilters,
} from "../_components/filter-modal";
import {
  FilterIcon,
  FloatingAddIcon,
  ImageUploadPlaceholderIcon,
  NoCandidates,
  SearchIcon,
  SortIcon,
} from "../_components/icons";
import { Modal } from "../_components/modal";
import {
  FeedbackPresence,
  LoadingButtonContent,
  MotionToast,
  motion,
} from "../_components/motion-system";
import {
  PeriodFilter,
  type PeriodFilterValue,
} from "../_components/period-filter";
import { QuickAddCandidateModal } from "../_components/quick-add-candidate-modal";
import { TablePagination } from "../_components/table-pagination";
import { useDebouncedValue } from "../_components/use-debounced-value";
import { useErrorToast } from "../_components/use-error-toast";
import { CandidatesTableSkeleton } from "./candidates-page-skeleton";
import { CandidateStatusSelect } from "./components/candidate-status-select";
import { QuickOverview } from "./components/quickOverview";
import { buildQuickCandidateCreateInput } from "./quick-candidate-create-input";

const CREATE_CANDIDATE_SUCCESS_KEY = "candidate-create-success";
const DEFAULT_CANDIDATE_PERIOD = "year" as const;

const CANDIDATE_SOURCE_ICONS = {
  "hh.uz": { src: "/hh.svg", label: "hh.uz" },
  linkedin: { src: "/linkedin.svg", label: "LinkedIn" },
  olx: { src: "/olx.svg", label: "OLX" },
  telegram: { src: "/telegram.svg", label: "Telegram" },
};

function CandidateSourceIcon({ source }: { source?: string | null }) {
  const t = useTranslations("Common");
  const normalizedSource = source?.trim() || undefined;
  const meta = normalizedSource
    ? CANDIDATE_SOURCE_ICONS[
        normalizedSource as keyof typeof CANDIDATE_SOURCE_ICONS
      ]
    : undefined;
  const label = meta?.label ?? normalizedSource ?? t("notSpecified");

  if (meta) {
    return (
      <Image
        alt={label}
        className="h-5 w-5"
        height={16}
        src={meta.src}
        title={label}
        unoptimized
        width={16}
      />
    );
  }

  return (
    <ImageUploadPlaceholderIcon
      aria-label={label}
      className="-ml-1.75 h-9 w-9 text-text-placeholder"
      role="img"
    />
  );
}

export default function CandidatesPage() {
  const t = useTranslations("Candidates");
  const common = useTranslations("Common");
  const localizeLookups = useLookupLocalizer();
  const utils = api.useUtils();
  const showError = useErrorToast();
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodFilterValue>(
    DEFAULT_CANDIDATE_PERIOD,
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebouncedValue(searchQuery.trim(), 300);
  const [isQuickAddModalOpen, setIsQuickAddModalOpen] = useState(false);
  const [isQuickOverviewOpen, setIsQuickOverviewOpen] = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(
    null,
  );
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [candidateToDelete, setCandidateToDelete] = useState<Candidate | null>(
    null,
  );
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<FilterModalFilters>(
    EMPTY_FILTER_MODAL_FILTERS,
  );

  const {
    data: lookups,
    isError: isLookupsError,
    isLoading: isLookupsLoading,
    refetch: refetchLookups,
  } = api.lookups.getCandidateCreateOptions.useQuery();
  const { data: vacancyLookups } =
    api.lookups.getVacancyCreateOptions.useQuery();
  const { data: telegramWarehouse } =
    api.integrations.getTelegramResumeVacancy.useQuery();

  const statusOptions = useMemo(
    () => localizeLookups(lookups?.statusOptions, "candidateStatuses"),
    [localizeLookups, lookups?.statusOptions],
  );
  const contactTypeOptions = useMemo(
    () => localizeLookups(lookups?.contactTypes, "contactTypes"),
    [localizeLookups, lookups?.contactTypes],
  );
  const sourceOptions = useMemo(
    () => localizeLookups(lookups?.sources, "sources"),
    [localizeLookups, lookups?.sources],
  );
  const defaultStatus = statusOptions[0]?.value;
  const candidateQueryInput = useMemo(
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
  const {
    data: candidatesData,
    isFetching: isFetchingCandidates,
    isLoading,
  } = api.candidates.list.useQuery(candidateQueryInput, {
    placeholderData: (previousData) => previousData,
  });
  const localTotal = candidatesData?.total ?? 0;
  const localItems = candidatesData?.items ?? [];

  // hh.uz applicants are persisted by the candidate sync and come back through
  // `candidates.list` like any other candidate. `candidates.listHh` was kept as an
  // always-empty stub for older clients; querying it here only added a round trip that the
  // table's loading state then waited on, plus a permanently-zero term in the page maths.
  const totalItems = localTotal;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const visibleCandidates: Candidate[] = localItems;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const message = window.sessionStorage.getItem(CREATE_CANDIDATE_SUCCESS_KEY);
    if (message) {
      setToastMessage(message);
      window.sessionStorage.removeItem(CREATE_CANDIDATE_SUCCESS_KEY);
    }
  }, []);

  useEffect(() => {
    if (!toastMessage) {
      return;
    }

    const timeout = window.setTimeout(() => setToastMessage(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [toastMessage]);

  useEffect(() => {
    if (!candidatesData) {
      return;
    }

    setCurrentPage((prev) => Math.min(prev, totalPages));
  }, [candidatesData, totalPages]);

  const createQuickCandidate = api.candidates.create.useMutation({
    onSuccess: (createdCandidate) => {
      if (!createdCandidate) {
        setToastMessage(t("saved"));
        setIsQuickAddModalOpen(false);
        return;
      }

      void utils.candidates.list.invalidate();

      setToastMessage(t("added"));
      setIsQuickAddModalOpen(false);
    },
    onError: () => {
      setToastMessage(t("saveError"));
    },
  });

  const deleteCandidate = api.candidates.delete.useMutation({
    onSuccess: async () => {
      setCandidateToDelete(null);
      setToastMessage(t("deleted"));
      await Promise.all([
        utils.candidates.list.invalidate(),
        utils.dashboard.getDashboardData.invalidate(),
        utils.sidebar.counts.invalidate(),
      ]);
    },
    onError: (error) => {
      showError(error, {
        dedupeKey: "candidate-delete",
        fallbackMessage: t("deleteError"),
      });
    },
  });

  const handleApplyFilters = (filters: FilterModalFilters) => {
    setAppliedFilters(filters);
    setCurrentPage(1);
    setIsFilterModalOpen(false);
  };

  const activeFilterCount = countActiveFilters(appliedFilters);

  const hasCandidates = localTotal > 0;
  const isTableLoading = isLoading || isFetchingCandidates;
  // A search or filter is "active" when the user has narrowed the result set in any way —
  // typed search, modal filters, or a non-default period. Keep the table mounted in those
  // cases so an empty result shows "Кандидаты не найдены" rather than the onboarding CTA.
  const hasActiveSearchOrFilters =
    searchQuery.trim().length > 0 ||
    activeFilterCount > 0 ||
    selectedPeriod !== DEFAULT_CANDIDATE_PERIOD;
  const showCandidatesTable =
    hasCandidates || isTableLoading || hasActiveSearchOrFilters;

  const handleQuickSaveCandidate = (payload: QuickAddCandidatePayload) => {
    createQuickCandidate.mutate(
      buildQuickCandidateCreateInput({
        defaultStatus,
        fallbackCity: common("notSpecified"),
        payload,
      }),
    );
  };

  const openQuickOverview = (candidateId: string) => {
    setSelectedCandidateId(candidateId);
    setIsQuickOverviewOpen(true);
  };

  if (isLookupsError && !isLookupsLoading) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center bg-bg-canvas px-4">
        <FeedbackPresence className="w-full max-w-[460px]" show>
          <div className="rounded-xl border border-danger-red-bg bg-danger-red-bg p-5 text-danger-red">
            <p className="mb-4 text-sm">{t("lookupsError")}</p>
            <button
              className="ui-button ui-button-primary"
              onClick={() => void refetchLookups()}
              type="button"
            >
              {common("retry")}
            </button>
          </div>
        </FeedbackPresence>
      </div>
    );
  }

  return (
    <>
      {lookups && (
        <QuickAddCandidateModal
          contactTypeOptions={contactTypeOptions}
          errorMessage={createQuickCandidate.error?.message}
          isOpen={isQuickAddModalOpen}
          isSaving={createQuickCandidate.isPending}
          onClose={() => {
            setIsQuickAddModalOpen(false);
            createQuickCandidate.reset();
          }}
          onSaveCandidate={handleQuickSaveCandidate}
          sourceOptions={sourceOptions}
          statusOptions={statusOptions}
        />
      )}

      <QuickOverview
        candidateId={selectedCandidateId}
        isOpen={isQuickOverviewOpen}
        onClose={() => setIsQuickOverviewOpen(false)}
      />

      <FilterModal
        cityOptions={vacancyLookups?.cities}
        initialFilters={appliedFilters}
        isOpen={isFilterModalOpen}
        onApply={handleApplyFilters}
        onClose={() => setIsFilterModalOpen(false)}
        sourceOptions={sourceOptions}
        statusOptions={statusOptions}
      />

      <Modal
        ariaLabel={t("deleteConfirmTitle")}
        closeOnBackdropClick={!deleteCandidate.isPending}
        closeOnEscape={!deleteCandidate.isPending}
        isOpen={Boolean(candidateToDelete)}
        onClose={() => {
          if (!deleteCandidate.isPending) {
            setCandidateToDelete(null);
          }
        }}
        title={t("deleteConfirmTitle")}
      >
        <div className="flex flex-col gap-5">
          <p className="text-sm text-text-secondary leading-[1.5]">
            {t("deleteConfirmDescription", {
              name: candidateToDelete?.name ?? "",
            })}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              className="ui-button ui-button-secondary w-full"
              disabled={deleteCandidate.isPending}
              onClick={() => setCandidateToDelete(null)}
              type="button"
            >
              {common("cancel")}
            </button>
            <button
              className="ui-button w-full bg-accent-red text-white hover:opacity-90"
              disabled={deleteCandidate.isPending}
              onClick={() => {
                if (candidateToDelete) {
                  deleteCandidate.mutate({ id: candidateToDelete.id });
                }
              }}
              type="button"
            >
              <LoadingButtonContent
                isLoading={deleteCandidate.isPending}
                label={common("delete")}
                loadingLabel={t("deleting")}
              />
            </button>
          </div>
        </div>
      </Modal>

      <MotionToast message={toastMessage} />

      <main className="flex flex-1 overflow-visible sm:h-full sm:overflow-auto">
        <div className="app-page flex min-h-full flex-col">
          <div className="page-header list-page-header">
            <h1 className="page-title">{t("title")}</h1>
            {showCandidatesTable && (
              <PeriodFilter
                ariaLabel={t("periodFilter")}
                onChange={(value) => {
                  setSelectedPeriod(value);
                  setCurrentPage(1);
                }}
                value={selectedPeriod}
              />
            )}
          </div>

          {showCandidatesTable ? (
            <>
              <div className="mb-5 flex flex-col gap-3 sm:flex-row">
                <div className="flex min-w-0 flex-1 gap-3">
                  <div className="relative min-w-0 flex-1">
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
                    aria-label={t("addFilters")}
                    className={`ui-button ui-button-secondary relative h-12 w-12 shrink-0 p-0 sm:h-11 sm:w-11 ${
                      activeFilterCount > 0
                        ? "border-primary-blue bg-primary-blue-light text-primary-blue"
                        : "border-border-light bg-bg-light"
                    }`}
                    onClick={() => setIsFilterModalOpen(true)}
                    title={t("addFilters")}
                    type="button"
                  >
                    <FilterIcon className="h-5 w-5" />
                    {activeFilterCount > 0 && (
                      <span
                        aria-hidden="true"
                        className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-blue px-1 font-semibold text-bg-light text-xs"
                      >
                        {activeFilterCount}
                      </span>
                    )}
                  </button>
                </div>
                {telegramWarehouse && (
                  <Link
                    className="ui-button ui-button-secondary border-border-light bg-bg-light"
                    href={`/vacancies/${telegramWarehouse.vacancyId}/funnel`}
                  >
                    {t("showWarehouse")}
                  </Link>
                )}
              </div>

              <div className="candidate-list-surface surface-card flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="hidden grid-cols-12 border-border-input border-b bg-table-header-bg px-4 py-3 lg:grid">
                  <div className="col-span-3 flex items-center gap-1 font-semibold text-text-muted text-xs">
                    <span>{common("name")}</span>
                    <SortIcon className="h-4 w-4" />
                  </div>
                  <div className="col-span-2 flex items-center gap-1 font-semibold text-text-muted text-xs">
                    <span>{common("status")}</span>
                    <SortIcon className="h-4 w-4" />
                  </div>
                  <div className="col-span-2 flex items-center gap-1 font-semibold text-text-muted text-xs">
                    <span>{common("city")}</span>
                    <SortIcon className="h-4 w-4" />
                  </div>
                  <div className="col-span-2 flex items-center gap-1 font-semibold text-text-muted text-xs">
                    <span>{common("createdAt")}</span>
                    <SortIcon className="h-4 w-4" />
                  </div>
                  <div className="col-span-2 flex items-center gap-1 font-semibold text-text-muted text-xs">
                    <span>{common("source")}</span>
                    <SortIcon className="h-4 w-4" />
                  </div>
                  <div className="col-span-1" />
                </div>

                {isTableLoading ? (
                  <CandidatesTableSkeleton />
                ) : (
                  <>
                    <div className="candidate-list-body min-h-0 flex-1 overflow-visible lg:overflow-auto">
                      {visibleCandidates.map((candidate: Candidate, index) => {
                        const isHhCandidate = candidate.source === "hh.uz";

                        return (
                          <motion.div
                            animate={{ opacity: 1, y: 0 }}
                            className={`candidate-list-card grid grid-cols-12 items-start border-border-input border-b px-4 py-3.5 last:border-b-0 lg:items-center ${
                              index % 2 === 0
                                ? "lg:bg-bg-light"
                                : "lg:bg-table-stripe-bg"
                            }`}
                            initial={{ opacity: 0, y: 7 }}
                            key={candidate.id}
                            layout
                            transition={{
                              delay: Math.min(index * 0.025, 0.18),
                              duration: 0.24,
                            }}
                          >
                            <div className="candidate-card-primary col-span-12 flex items-start gap-2.5 lg:col-span-3">
                              <Checkbox
                                //TODO: fix it when selection will be implemented
                                checked={false}
                                onChange={() => {}}
                              />
                              <div className="min-w-0">
                                {isHhCandidate ? (
                                  <Link
                                    className="truncate font-semibold text-sm text-text-heading leading-5 hover:text-primary-blue"
                                    href={`/candidates/${candidate.id}`}
                                  >
                                    {candidate.name}
                                  </Link>
                                ) : (
                                  <button
                                    className="truncate text-left font-semibold text-sm text-text-heading leading-5 hover:text-primary-blue"
                                    onClick={() =>
                                      openQuickOverview(candidate.id)
                                    }
                                    type="button"
                                  >
                                    {candidate.name}
                                  </button>
                                )}
                                <div className="mt-1 truncate text-text-placeholder text-xs leading-none">
                                  {candidate.patronymic}
                                </div>
                              </div>
                            </div>

                            <div className="candidate-card-status col-span-6 mt-3 lg:col-span-2 lg:mt-0">
                              <CandidateStatusSelect
                                candidateId={candidate.id}
                                candidateName={candidate.name}
                                listQueryInput={candidateQueryInput}
                                onError={() =>
                                  setToastMessage(t("statusUpdateError"))
                                }
                                onSuccess={() =>
                                  setToastMessage(t("statusUpdated"))
                                }
                                status={candidate.status}
                                statusOptions={statusOptions}
                              />
                            </div>

                            <div className="hidden text-sm text-text-heading leading-none lg:col-span-2 lg:block">
                              {candidate.city || "-"}
                            </div>

                            <div className="hidden text-sm text-text-heading leading-none lg:col-span-2 lg:block">
                              {candidate.createdAt || "-"}
                            </div>

                            <div className="hidden lg:col-span-2 lg:flex lg:items-center">
                              <CandidateSourceIcon source={candidate.source} />
                            </div>

                            <div className="candidate-card-actions col-span-6 mt-3 flex items-center justify-end gap-3 lg:col-span-1 lg:mt-0">
                              <Link
                                className="flex items-center gap-1 font-medium text-primary-blue text-sm leading-none hover:text-primary-blue-hover"
                                href={`/candidates/${candidate.id}`}
                              >
                                <span className="inline lg:hidden xl:inline">
                                  {common("details")}
                                </span>
                              </Link>
                              <DeleteRowActionMenu
                                disabled={deleteCandidate.isPending}
                                onDelete={() => setCandidateToDelete(candidate)}
                              />
                            </div>

                            <dl className="candidate-card-meta col-span-12 mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-xs lg:hidden">
                              <div>
                                <dt className="text-text-placeholder">
                                  {t("city")}
                                </dt>
                                <dd className="mt-1 font-semibold text-text-heading">
                                  {candidate.city || "-"}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-text-placeholder">
                                  {t("created")}
                                </dt>
                                <dd className="mt-1 font-semibold text-text-heading">
                                  {candidate.createdAt || "-"}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-text-placeholder">
                                  {t("source")}
                                </dt>
                                <dd className="mt-1 flex min-h-5 items-center gap-1.5">
                                  <CandidateSourceIcon
                                    source={candidate.source}
                                  />
                                </dd>
                              </div>
                            </dl>
                          </motion.div>
                        );
                      })}

                      {visibleCandidates.length === 0 && (
                        <div className="px-4 py-10 text-center text-sm text-text-placeholder">
                          {t("empty")}
                        </div>
                      )}
                    </div>

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
              <div className="flex w-full max-w-[240px] flex-col items-center">
                <NoCandidates className="h-[190px] w-[240px] opacity-70" />
              </div>
            </div>
          )}
        </div>
      </main>

      <button
        aria-label={t("quickAdd")}
        className="fixed right-5 bottom-5 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary-blue text-white shadow-toast transition-[background-color,transform] hover:-translate-y-0.5 hover:bg-primary-blue-hover sm:right-6 sm:bottom-6"
        onClick={() => setIsQuickAddModalOpen(true)}
        type="button"
      >
        <FloatingAddIcon className="h-10 w-10" />
      </button>
    </>
  );
}
