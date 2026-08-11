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
  MoreIcon,
  NoCandidates,
  SearchIcon,
  SortIcon,
} from "../_components/icons";
import {
  FeedbackPresence,
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
import { CandidatesTableSkeleton } from "./candidates-page-skeleton";
import { CandidateStatusSelect } from "./components/candidate-status-select";
import { QuickOverview } from "./components/quickOverview";

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
  const offset = (currentPage - 1) * itemsPerPage;
  const localItems = candidatesData?.items ?? [];
  const hhOffset = Math.max(0, offset - localTotal);
  const hhLimit = Math.max(0, itemsPerPage - localItems.length);
  const shouldIncludeHhCandidates =
    !appliedFilters.city.trim() &&
    (appliedFilters.sources.length === 0 ||
      appliedFilters.sources.includes("hh.uz")) &&
    (appliedFilters.statuses.length === 0 ||
      appliedFilters.statuses.includes("new"));
  const hhQueryInput = useMemo(
    () => ({
      search: debouncedSearchQuery || undefined,
      statuses: appliedFilters.statuses,
      city: appliedFilters.city.trim() || undefined,
      sources: appliedFilters.sources,
      limit: hhLimit,
      offset: hhOffset,
    }),
    [
      appliedFilters.city,
      appliedFilters.sources,
      appliedFilters.statuses,
      debouncedSearchQuery,
      hhLimit,
      hhOffset,
    ],
  );
  const {
    data: hhCandidatesData,
    isFetching: isFetchingHhCandidates,
    isLoading: isLoadingHhCandidates,
  } = api.candidates.listHh.useQuery(hhQueryInput, {
    enabled:
      Boolean(candidatesData) && shouldIncludeHhCandidates && hhLimit > 0,
    placeholderData: (previousData) => previousData,
    staleTime: 5 * 60 * 1000,
  });

  const hhTotal = shouldIncludeHhCandidates
    ? (hhCandidatesData?.total ?? 0)
    : 0;
  const totalItems = localTotal + hhTotal;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const isWaitingForHhPagination =
    Boolean(candidatesData) &&
    shouldIncludeHhCandidates &&
    hhLimit > 0 &&
    isFetchingHhCandidates;

  // Candidates shown in the table: local candidates first, then hh.uz
  // candidates filling the remaining slots for the current page.
  const visibleCandidates: Candidate[] = [
    ...localItems,
    ...(hhCandidatesData?.items ?? []),
  ];

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
    if (!candidatesData || isWaitingForHhPagination) {
      return;
    }

    setCurrentPage((prev) => Math.min(prev, totalPages));
  }, [candidatesData, isWaitingForHhPagination, totalPages]);

  const createQuickCandidate = api.candidates.create.useMutation({
    onSuccess: (createdCandidate) => {
      if (!createdCandidate) {
        setToastMessage(t("saved"));
        setIsQuickAddModalOpen(false);
        return;
      }

      void utils.candidates.list.invalidate();
      void utils.candidates.listHh.invalidate();

      setToastMessage(t("added"));
      setIsQuickAddModalOpen(false);
    },
    onError: () => {
      setToastMessage(t("saveError"));
    },
  });

  const handleApplyFilters = (filters: FilterModalFilters) => {
    setAppliedFilters(filters);
    setCurrentPage(1);
    setIsFilterModalOpen(false);
  };

  const activeFilterCount = countActiveFilters(appliedFilters);

  const hasCandidates = localTotal > 0 || hhTotal > 0;
  const isTableLoading =
    isLoading ||
    isFetchingCandidates ||
    (Boolean(candidatesData) &&
      shouldIncludeHhCandidates &&
      hhLimit > 0 &&
      (isLoadingHhCandidates || isFetchingHhCandidates));
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
    const prefill = payload.resumePrefillData;
    const directContacts: { type: string; value: string }[] = [];

    if (payload.email.trim()) {
      directContacts.push({ type: "email", value: payload.email.trim() });
    }
    if (payload.contactValue.trim()) {
      directContacts.push({
        type: payload.contactType,
        value: payload.contactValue.trim(),
      });
    }

    const parsedContacts = (prefill?.contacts ?? []).filter(
      (contact) => contact.type.trim().toLowerCase() !== "email",
    );
    const mergedContacts: { type: string; value: string }[] = [];

    for (const parsedContact of [...directContacts, ...parsedContacts]) {
      const isDuplicate = mergedContacts.some(
        (contact) =>
          contact.type.trim().toLowerCase() ===
            parsedContact.type.trim().toLowerCase() &&
          contact.value.trim().toLowerCase() ===
            parsedContact.value.trim().toLowerCase(),
      );
      if (!isDuplicate) {
        mergedContacts.push(parsedContact);
      }
    }

    createQuickCandidate.mutate({
      id: payload.candidateId,
      fullName: payload.fullName,
      city: prefill?.city || common("notSpecified"),
      contacts: mergedContacts,
      source: payload.source || prefill?.source || undefined,
      aiAnalysis: payload.aiAnalysis || undefined,
      salaryExpectation: prefill?.salaryExpectation,
      salaryCurrency: prefill?.salaryCurrency ?? "UZS",
      currentPosition: prefill?.currentPosition || undefined,
      skills: prefill?.skills ?? [],
      languages: prefill?.languages ?? [],
      status: payload.status || prefill?.status || defaultStatus,
      resumeFileId: payload.resumeFileId || undefined,
      resumeFileName: payload.resumeFileName || undefined,
      resumeFileSize: payload.resumeFileSize || undefined,
    });
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

      <MotionToast message={toastMessage} />

      <main className="flex h-full flex-1 overflow-auto">
        <div className="app-page flex min-h-full flex-col">
          <div className="page-header">
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
                      ? "border-primary-blue bg-primary-blue/5"
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
                        : "bg-border-light text-text-label"
                    }`}
                  >
                    {activeFilterCount > 0 ? activeFilterCount : "+"}
                  </span>
                </button>
                {telegramWarehouse && (
                  <Link
                    className="ui-button ui-button-secondary border-border-light bg-bg-light"
                    href={`/vacancies/${telegramWarehouse.vacancyId}/funnel`}
                  >
                    {t("showWarehouse")}
                  </Link>
                )}
              </div>

              <div className="surface-card flex min-h-0 flex-1 flex-col overflow-hidden">
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
                    <div className="min-h-0 flex-1 overflow-auto">
                      {visibleCandidates.map((candidate: Candidate, index) => {
                        const isHhCandidate = candidate.source === "hh.uz";

                        return (
                          <motion.div
                            animate={{ opacity: 1, y: 0 }}
                            className={`grid grid-cols-12 items-start border-border-input border-b px-4 py-3.5 last:border-b-0 lg:items-center ${
                              index % 2 === 0
                                ? "bg-bg-light"
                                : "bg-table-stripe-bg"
                            }`}
                            initial={{ opacity: 0, y: 7 }}
                            key={candidate.id}
                            layout
                            transition={{
                              delay: Math.min(index * 0.025, 0.18),
                              duration: 0.24,
                            }}
                          >
                            <div className="col-span-12 flex items-start gap-2.5 lg:col-span-3">
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

                            <div className="col-span-6 mt-3 lg:col-span-2 lg:mt-0">
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

                            <div className="col-span-6 mt-3 flex items-center justify-end gap-3 lg:col-span-1 lg:mt-0">
                              <Link
                                className="flex items-center gap-1 font-medium text-primary-blue text-sm leading-none hover:text-primary-blue-hover"
                                href={`/candidates/${candidate.id}`}
                              >
                                <span className="hidden xl:inline">
                                  {common("details")}
                                </span>
                              </Link>
                              <button
                                className="p-1 text-text-placeholder transition-colors hover:text-text-secondary"
                                type="button"
                              >
                                <MoreIcon className="h-4 w-4" />
                              </button>
                            </div>

                            <div className="col-span-12 mt-3 flex flex-wrap gap-4 text-text-placeholder text-xs lg:hidden">
                              <span>
                                {t("city")} {candidate.city || "-"}
                              </span>
                              <span>
                                {t("created")} {candidate.createdAt || "-"}
                              </span>
                              <span className="flex items-center gap-1.5">
                                {t("source")}
                                <CandidateSourceIcon
                                  source={candidate.source}
                                />
                              </span>
                            </div>
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
              <div className="flex w-full max-w-[240px] flex-col items-center gap-10">
                <NoCandidates className="h-[190px] w-[240px] opacity-70" />
                <button
                  className="ui-button ui-button-primary"
                  onClick={() => setIsQuickAddModalOpen(true)}
                  type="button"
                >
                  {t("add")}
                </button>
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
