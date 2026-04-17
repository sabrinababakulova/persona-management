"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api } from "~/trpc/react";
import type { QuickAddCandidatePayload } from "~/types/components/quick-add-candidate-modal";
import type { Candidate, CandidateStatus } from "~/types/pages/candidates-page";
import type { LookupOption } from "~/types/shared/candidate-lookups";
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
  MoreIcon,
  NoCandidates,
  SearchIcon,
  SortIcon,
} from "../_components/icons";
import {
  PeriodFilter,
  type PeriodFilterValue,
} from "../_components/period-filter";
import { QuickAddCandidateModal } from "../_components/quick-add-candidate-modal";
import { TablePagination } from "../_components/table-pagination";
import { useDebouncedValue } from "../_components/use-debounced-value";
import { QuickOverview } from "./components/quickOverview";

const CREATE_CANDIDATE_SUCCESS_KEY = "candidate-create-success";
const DEFAULT_CANDIDATE_PERIOD = "year" as const;

const CANDIDATE_STATUS_VALUES: CandidateStatus[] = [
  "new",
  "screening",
  "interview",
  "offer",
  "hired",
  "rejected",
];

const statusToneConfig: Record<
  CandidateStatus,
  {
    containerClassName: string;
    textClassName: string;
  }
> = {
  new: {
    containerClassName: "border border-status-outline-border bg-bg-light",
    textClassName: "text-text-placeholder",
  },
  screening: {
    containerClassName: "bg-status-neutral-bg",
    textClassName: "text-status-neutral",
  },
  interview: {
    containerClassName: "bg-status-info-bg",
    textClassName: "text-primary-blue",
  },
  offer: {
    containerClassName: "bg-status-offer-bg",
    textClassName: "text-status-offer",
  },
  hired: {
    containerClassName: "bg-status-active-soft",
    textClassName: "text-status-active-strong",
  },
  rejected: {
    containerClassName: "bg-status-danger-soft",
    textClassName: "text-accent-red",
  },
};

function isCandidateStatus(value: string): value is CandidateStatus {
  return CANDIDATE_STATUS_VALUES.includes(value as CandidateStatus);
}

function mapStatusOptions(options: LookupOption[]): LookupOption[] {
  return options.filter((option) => isCandidateStatus(option.value));
}

export default function CandidatesPage() {
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
  const { data: hasAnyCandidates = false, isLoading: isAnyCandidatesLoading } =
    api.candidates.hasCandidates.useQuery();
  const {
    data: lookups,
    isError: isLookupsError,
    isLoading: isLookupsLoading,
    refetch: refetchLookups,
  } = api.lookups.getCandidateCreateOptions.useQuery();
  const { data: vacancyLookups } =
    api.lookups.getVacancyCreateOptions.useQuery();
  const [localCandidates, setLocalCandidates] = useState<Candidate[]>([]);

  const statusOptions = useMemo(
    () => mapStatusOptions(lookups?.statusOptions ?? []),
    [lookups?.statusOptions],
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
  const { data: candidatesData, isLoading } =
    api.candidates.getAllCandidates.useQuery(candidateQueryInput);
  const totalItems = candidatesData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));

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

  const createQuickCandidate = api.candidates.createCandidate.useMutation({
    onSuccess: (createdCandidate) => {
      if (!createdCandidate) {
        setToastMessage("Кандидат сохранен");
        setIsQuickAddModalOpen(false);
        return;
      }

      void utils.candidates.getAllCandidates.invalidate();
      void utils.candidates.hasCandidates.invalidate();

      setToastMessage("Кандидат успешно добавлен");
      setIsQuickAddModalOpen(false);
    },
    onError: () => {
      setToastMessage("Не удалось сохранить кандидата");
    },
  });

  const updateCandidateStatus = api.candidates.updateCandidate.useMutation({
    onMutate: async ({ id, status }) => {
      await utils.candidates.getAllCandidates.cancel(candidateQueryInput);

      const previousCandidates =
        utils.candidates.getAllCandidates.getData(candidateQueryInput);

      if (status && isCandidateStatus(status)) {
        utils.candidates.getAllCandidates.setData(
          candidateQueryInput,
          (existing) =>
            existing
              ? {
                  ...existing,
                  items: existing.items.map((candidate) =>
                    candidate.id === id
                      ? { ...candidate, status: status as CandidateStatus }
                      : candidate,
                  ),
                }
              : existing,
        );
      }

      return { previousCandidates };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousCandidates) {
        utils.candidates.getAllCandidates.setData(
          candidateQueryInput,
          context.previousCandidates,
        );
      }
      setToastMessage("Не удалось обновить статус кандидата");
    },
    onSuccess: () => {
      setToastMessage("Статус кандидата обновлен");
    },
    onSettled: () => {
      void utils.candidates.getAllCandidates.invalidate();
    },
  });

  // Merge server data with local selection state
  const candidates =
    candidatesData?.items.map((c: Candidate) => ({
      ...c,
      selected: localCandidates.find((lc) => lc.id === c.id)?.selected ?? false,
    })) ?? [];

  const toggleSelection = (id: string) => {
    setLocalCandidates((prev) => {
      const existing = prev.find((candidate) => candidate.id === id);
      if (existing) {
        return prev.map((candidate) =>
          candidate.id === id
            ? { ...candidate, selected: !candidate.selected }
            : candidate,
        );
      }
      return [...prev, { id, selected: true } as Candidate];
    });
  };

  const handleApplyFilters = (filters: FilterModalFilters) => {
    setAppliedFilters(filters);
    setCurrentPage(1);
    setIsFilterModalOpen(false);
  };

  const activeFilterCount = countActiveFilters(appliedFilters);

  const hasCandidates = hasAnyCandidates;
  const showCandidatesTable = hasCandidates || isLoading;

  const handleStatusChange = (candidateId: string, nextStatus: string) => {
    if (!isCandidateStatus(nextStatus)) {
      setToastMessage("Выбран неизвестный статус");
      return;
    }

    const currentStatus =
      candidates.find((candidate) => candidate.id === candidateId)?.status ??
      null;

    if (!currentStatus || currentStatus === nextStatus) {
      return;
    }

    updateCandidateStatus.mutate({
      id: candidateId,
      status: nextStatus,
    });
  };

  const handleQuickSaveCandidate = (payload: QuickAddCandidatePayload) => {
    const prefill = payload.resumePrefillData;
    const primaryContact =
      payload.contactValue.trim().length > 0
        ? [{ type: payload.contactType, value: payload.contactValue.trim() }]
        : [];
    const parsedContacts = prefill?.contacts ?? [];
    const mergedContacts = [...primaryContact];

    for (const parsedContact of parsedContacts) {
      const isDuplicate = mergedContacts.some(
        (contact) =>
          contact.type === parsedContact.type &&
          contact.value === parsedContact.value,
      );
      if (!isDuplicate) {
        mergedContacts.push(parsedContact);
      }
    }

    createQuickCandidate.mutate({
      id: payload.candidateId,
      fullName: payload.fullName,
      city: prefill?.city || "Не указан",
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
      <div className="flex min-h-screen items-center justify-center bg-bg-light px-4">
        <div className="w-full max-w-[460px] rounded-[8px] border border-danger-red-bg bg-danger-red-bg p-5 text-danger-red">
          <p className="mb-4 text-[14px]">
            Не удалось загрузить справочники из базы данных.
          </p>
          <button
            className="rounded-[6px] bg-primary-blue px-4 py-2 text-[14px] text-bg-light hover:bg-primary-blue-hover"
            onClick={() => void refetchLookups()}
            type="button"
          >
            Повторить
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {lookups && (
        <QuickAddCandidateModal
          contactTypeOptions={lookups.contactTypes}
          errorMessage={createQuickCandidate.error?.message}
          isOpen={isQuickAddModalOpen}
          isSaving={createQuickCandidate.isPending}
          onClose={() => {
            setIsQuickAddModalOpen(false);
            createQuickCandidate.reset();
          }}
          onSaveCandidate={handleQuickSaveCandidate}
          sourceOptions={lookups.sources}
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
        sourceOptions={lookups?.sources}
        statusOptions={statusOptions}
      />

      {toastMessage && (
        <output
          aria-live="polite"
          className="fixed top-6 right-6 z-70 rounded-[10px] bg-text-heading px-4 py-3 text-[14px] text-bg-light shadow-toast"
        >
          {toastMessage}
        </output>
      )}

      <main className="flex h-full flex-1 overflow-auto">
        <div className="flex min-h-full w-full flex-col p-4 pb-10 lg:p-8 lg:pb-10">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="font-bold text-2xl text-text-heading lg:text-3xl">
              Кандидаты
            </h1>
            {(showCandidatesTable || isAnyCandidatesLoading) && (
              <PeriodFilter
                ariaLabel="Фильтр периода кандидатов"
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
              <div className="mb-6 flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <SearchIcon className="absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-text-placeholder" />
                  <input
                    className="w-full rounded-xl border border-border-light bg-bg-light py-3 pr-4 pl-12 text-text-label placeholder:text-text-placeholder focus:border-primary-blue focus:outline-none focus:ring-2 focus:ring-primary-blue/20"
                    onChange={(event) => {
                      setSearchQuery(event.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Поиск кандидатов"
                    type="text"
                    value={searchQuery}
                  />
                </div>
                <button
                  className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-text-label transition-colors hover:bg-bg-light ${
                    activeFilterCount > 0
                      ? "border-primary-blue bg-primary-blue/5"
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
                        : "bg-border-light text-text-label"
                    }`}
                  >
                    {activeFilterCount > 0 ? activeFilterCount : "+"}
                  </span>
                </button>
              </div>

              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[8px] border border-border-input bg-bg-light">
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
                    <span>Дата создания</span>
                    <SortIcon className="h-4 w-4" />
                  </div>
                  <div className="col-span-2 flex items-center gap-1 text-[14px] text-text-placeholder">
                    <span>Источник</span>
                    <SortIcon className="h-4 w-4" />
                  </div>
                  <div className="col-span-1" />
                </div>

                {isLoading ? (
                  <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-4 py-10 text-text-placeholder">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-border-light border-t-primary-blue" />
                    <div className="text-[14px]">Загрузка кандидатов...</div>
                  </div>
                ) : (
                  <>
                    <div className="min-h-0 flex-1 overflow-auto">
                      {candidates.map((candidate: Candidate, index) => {
                        const statusTone =
                          statusToneConfig[candidate.status] ??
                          statusToneConfig.new;
                        const isStatusPending =
                          updateCandidateStatus.isPending &&
                          updateCandidateStatus.variables?.id === candidate.id;

                        return (
                          <div
                            className={`grid grid-cols-12 items-start border-border-input border-b px-4 py-[14px] last:border-b-0 lg:items-center ${
                              index % 2 === 0 ? "bg-bg-light" : "bg-bg-input"
                            }`}
                            key={candidate.id}
                          >
                            <div className="col-span-12 flex items-start gap-2.5 lg:col-span-3">
                              <Checkbox
                                checked={candidate.selected || false}
                                onChange={() => toggleSelection(candidate.id)}
                              />
                              <div className="min-w-0">
                                <button
                                  className="truncate text-left font-medium text-[14px] text-text-heading leading-none hover:text-primary-blue"
                                  onClick={() => openQuickOverview(candidate.id)}
                                  type="button"
                                >
                                  {candidate.name}
                                </button>
                                <div className="mt-1 truncate text-[12px] text-text-placeholder leading-none">
                                  {candidate.patronymic}
                                </div>
                              </div>
                            </div>

                            <div className="col-span-6 mt-3 lg:col-span-2 lg:mt-0">
                              <div
                                className={`relative inline-flex min-w-[124px] items-center overflow-hidden rounded-[6px] px-1 ${statusTone.containerClassName}`}
                              >
                                <select
                                  aria-label={`Статус кандидата ${candidate.name}`}
                                  className={`h-[32px] w-full appearance-none bg-transparent px-2 pr-6 text-[12px] uppercase leading-none tracking-[-0.24px] ${statusTone.textClassName} font-semibold disabled:cursor-not-allowed disabled:opacity-70`}
                                  disabled={isStatusPending}
                                  onChange={(event) => {
                                    handleStatusChange(
                                      candidate.id,
                                      event.target.value,
                                    );
                                  }}
                                  value={candidate.status}
                                >
                                  {statusOptions.map((option) => (
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
                            </div>

                            <div className="hidden text-[14px] text-text-heading leading-none lg:col-span-2 lg:block">
                              {candidate.city || "-"}
                            </div>

                            <div className="hidden text-[14px] text-text-heading leading-none lg:col-span-2 lg:block">
                              {candidate.createdAt || "-"}
                            </div>

                            <div className="hidden text-[14px] text-text-heading leading-none lg:col-span-2 lg:block">
                              {candidate.source || "-"}
                            </div>

                            <div className="col-span-6 mt-3 flex items-center justify-end gap-3 lg:col-span-1 lg:mt-0">
                              <Link
                                className="flex items-center gap-1 text-[14px] text-primary-blue leading-none hover:text-primary-blue-hover"
                                href={`/candidates/${candidate.id}`}
                              >
                                <span className="hidden xl:inline">детали</span>
                              </Link>
                              <button
                                className="p-1 text-text-placeholder transition-colors hover:text-text-secondary"
                                type="button"
                              >
                                <MoreIcon className="h-4 w-4" />
                              </button>
                            </div>

                            <div className="col-span-12 mt-3 flex flex-wrap gap-4 text-[12px] text-text-placeholder lg:hidden">
                              <span>Город: {candidate.city || "-"}</span>
                              <span>Создан: {candidate.createdAt || "-"}</span>
                              <span>Источник: {candidate.source || "-"}</span>
                            </div>
                          </div>
                        );
                      })}

                      {candidates.length === 0 && (
                        <div className="px-4 py-10 text-center text-[14px] text-text-placeholder">
                          Кандидаты не найдены
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
                  className="flex h-[40px] w-[190px] items-center justify-center rounded-[6px] bg-primary-blue px-3 py-2.5 font-medium text-[16px] text-bg-light leading-none tracking-[-0.32px] transition-colors hover:bg-primary-blue-hover"
                  onClick={() => setIsQuickAddModalOpen(true)}
                  type="button"
                >
                  Добавить кандидата
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      <button
        aria-label="Быстро добавить кандидата"
        className="fixed right-6 bottom-6 z-40 flex h-14 w-14 items-center justify-center rounded-[200px] bg-primary-blue text-bg-light shadow-lg transition-colors hover:bg-primary-blue-hover"
        onClick={() => setIsQuickAddModalOpen(true)}
        type="button"
      >
        <FloatingAddIcon className="h-10 w-10" />
      </button>
    </>
  );
}
