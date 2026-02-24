"use client";

import { useEffect, useMemo, useState } from "react";
import { DEFAULT_CANDIDATE_LOOKUPS } from "~/shared/candidate-lookups";
import { api } from "~/trpc/react";
import type { QuickAddCandidatePayload } from "~/types/components/quick-add-candidate-modal";
import type { Candidate, CandidateStatus } from "~/types/pages/candidates-page";
import type { LookupOption } from "~/types/shared/candidate-lookups";
import { Checkbox } from "../_components/checkbox";
import {
  ChevronDownIcon,
  FilterIcon,
  FloatingAddIcon,
  FunnelIcon,
  MoreIcon,
  SearchIcon,
  SortIcon,
} from "../_components/icons";
import { QuickAddCandidateModal } from "../_components/quick-add-candidate-modal";
import { QuickOverview } from "./components/quickOverview";

const CREATE_CANDIDATE_SUCCESS_KEY = "candidate-create-success";

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
    containerClassName: "border border-status-outline-border bg-white",
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
  const filtered = options.filter((option) => isCandidateStatus(option.value));
  if (filtered.length > 0) {
    return filtered;
  }

  return DEFAULT_CANDIDATE_LOOKUPS.statusOptions;
}

export default function CandidatesPage() {
  const utils = api.useUtils();
  const { data: candidatesData, isLoading } =
    api.candidates.getAllCandidates.useQuery();
  const { data: lookups } = api.lookups.getCandidateCreateOptions.useQuery(
    undefined,
    {
      retry: false,
      staleTime: 5 * 60 * 1000,
    },
  );
  const [localCandidates, setLocalCandidates] = useState<Candidate[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isQuickAddModalOpen, setIsQuickAddModalOpen] = useState(false);
  const [isQuickOverviewOpen, setIsQuickOverviewOpen] = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(
    null,
  );
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const candidateLookups = lookups ?? DEFAULT_CANDIDATE_LOOKUPS;
  const statusOptions = useMemo(
    () => mapStatusOptions(candidateLookups.statusOptions),
    [candidateLookups.statusOptions],
  );

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

  const createQuickCandidate = api.candidates.createCandidate.useMutation({
    onSuccess: (createdCandidate) => {
      if (!createdCandidate) {
        setToastMessage("Кандидат сохранен");
        setIsQuickAddModalOpen(false);
        return;
      }

      const parts = createdCandidate.fullName.split(" ");
      const mappedCandidate: Candidate = {
        id: createdCandidate.id,
        name: parts.slice(0, 2).join(" "),
        patronymic: parts.slice(2).join(" "),
        city: createdCandidate.city ?? "",
        status: (createdCandidate.status as CandidateStatus) ?? "new",
        createdAt: createdCandidate.createdAt
          ? new Date(createdCandidate.createdAt).toLocaleDateString("ru-RU", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            })
          : "",
        source: createdCandidate.source ?? "",
      };

      utils.candidates.getAllCandidates.setData(undefined, (existing = []) => [
        mappedCandidate,
        ...existing,
      ]);
      void utils.candidates.getAllCandidates.invalidate();

      setToastMessage("Кандидат успешно добавлен");
      setIsQuickAddModalOpen(false);
    },
    onError: () => {
      setToastMessage("Не удалось сохранить кандидата");
    },
  });

  const updateCandidateStatus = api.candidates.updateCandidate.useMutation({
    onMutate: async ({ id, status }) => {
      await utils.candidates.getAllCandidates.cancel();

      const previousCandidates = utils.candidates.getAllCandidates.getData();

      if (status && isCandidateStatus(status)) {
        utils.candidates.getAllCandidates.setData(undefined, (existing = []) =>
          existing.map((candidate) =>
            candidate.id === id
              ? { ...candidate, status: status as CandidateStatus }
              : candidate,
          ),
        );
      }

      return { previousCandidates };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousCandidates) {
        utils.candidates.getAllCandidates.setData(
          undefined,
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
    candidatesData?.map((c: Candidate) => ({
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

  const filteredCandidates = candidates.filter((candidate: Candidate) => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const fullName = `${candidate.name} ${candidate.patronymic}`.toLowerCase();

    return fullName.includes(normalizedQuery);
  });

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
    createQuickCandidate.mutate({
      fullName: payload.fullName,
      city: "Не указан",
      contacts: payload.contactValue
        ? [{ type: payload.contactType, value: payload.contactValue }]
        : [],
      source: payload.source || undefined,
      status: "new",
    });
  };

  const openQuickOverview = (candidateId: string) => {
    setSelectedCandidateId(candidateId);
    setIsQuickOverviewOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-light">
        <div className="text-gray-600">Загрузка...</div>
      </div>
    );
  }

  return (
    <>
      <QuickAddCandidateModal
        contactTypeOptions={candidateLookups.contactTypes}
        errorMessage={createQuickCandidate.error?.message}
        isOpen={isQuickAddModalOpen}
        isSaving={createQuickCandidate.isPending}
        onClose={() => {
          setIsQuickAddModalOpen(false);
          createQuickCandidate.reset();
        }}
        onSaveCandidate={handleQuickSaveCandidate}
        sourceOptions={candidateLookups.sources}
      />

      <QuickOverview
        candidateId={selectedCandidateId}
        isOpen={isQuickOverviewOpen}
        onClose={() => setIsQuickOverviewOpen(false)}
      />

      {toastMessage && (
        <output
          aria-live="polite"
          className="fixed top-6 right-6 z-70 rounded-[10px] bg-text-heading px-4 py-3 text-[14px] text-white shadow-toast"
        >
          {toastMessage}
        </output>
      )}

      <main className="flex-1 overflow-auto">
        <div className="p-4 lg:p-8">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="font-bold text-2xl text-gray-900 lg:text-3xl">
              Кандидаты
            </h1>
            <button
              className="flex items-center gap-2 self-start rounded-lg border border-border-light bg-white px-4 py-2 text-gray-700 hover:bg-bg-light sm:self-auto"
              type="button"
            >
              Последние 7 дней
              <ChevronDownIcon className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-6 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <SearchIcon className="absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                className="w-full rounded-xl border border-border-light bg-white py-3 pr-4 pl-12 text-gray-700 placeholder-gray-400 focus:border-primary-blue focus:outline-none focus:ring-2 focus:ring-primary-blue/20"
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Поиск кандидатов"
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
                <span>Дата создания</span>
                <SortIcon className="h-4 w-4" />
              </div>
              <div className="col-span-2 flex items-center gap-1 text-[14px] text-text-placeholder">
                <span>Источник</span>
                <SortIcon className="h-4 w-4" />
              </div>
              <div className="col-span-1" />
            </div>

            {filteredCandidates.map((candidate: Candidate, index) => {
              const statusTone =
                statusToneConfig[candidate.status] ?? statusToneConfig.new;
              const isStatusPending =
                updateCandidateStatus.isPending &&
                updateCandidateStatus.variables?.id === candidate.id;

              return (
                <div
                  className={`grid grid-cols-12 items-start border-border-input border-b px-4 py-[14px] last:border-b-0 lg:items-center ${
                    index % 2 === 0 ? "bg-white" : "bg-bg-input"
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
                          handleStatusChange(candidate.id, event.target.value);
                        }}
                        value={candidate.status}
                      >
                        {statusOptions.map((option) => (
                          <option key={option.value} value={option.value}>
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
                    <button
                      className="flex items-center gap-1 text-[14px] text-primary-blue leading-none hover:text-primary-blue-hover"
                      onClick={() => openQuickOverview(candidate.id)}
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
                    <span>Город: {candidate.city || "-"}</span>
                    <span>Создан: {candidate.createdAt || "-"}</span>
                    <span>Источник: {candidate.source || "-"}</span>
                  </div>
                </div>
              );
            })}

            {filteredCandidates.length === 0 && (
              <div className="px-4 py-10 text-center text-[14px] text-text-placeholder">
                Кандидаты не найдены
              </div>
            )}

            <div className="flex justify-end border-border-input border-t bg-white px-4 py-3">
              <button
                className="flex w-[116px] items-center justify-between rounded-[6px] border border-border-input px-3 py-2.5 text-[14px] text-text-secondary"
                type="button"
              >
                <span>Действия</span>
                <ChevronDownIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </main>

      <button
        aria-label="Быстро добавить кандидата"
        className="fixed right-6 bottom-6 z-40 flex h-14 w-14 items-center justify-center rounded-[200px] bg-primary-blue text-white shadow-lg transition-colors hover:bg-primary-blue-hover"
        onClick={() => setIsQuickAddModalOpen(true)}
        type="button"
      >
        <FloatingAddIcon className="h-10 w-10" />
      </button>
    </>
  );
}
