"use client";

import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AssignCandidateToVacancyModal } from "~/app/_components/assign-candidate-to-vacancy-modal";
import { Breadcrumbs } from "~/app/_components/Breadcrumbs";
import {
  countActiveFilters,
  EMPTY_FILTER_MODAL_FILTERS,
  FilterModal,
  type FilterModalFilters,
} from "~/app/_components/filter-modal";
import {
  AIGenerationIcon,
  ChevronRightIcon,
  DollarIcon,
  DownloadIcon,
  FilterIcon,
  MailIcon,
  MoreIcon,
  OutlineBriefcaseIcon,
  PlusIcon,
  SearchIcon,
  SortIcon,
  VacancyResponsesIcon,
} from "~/app/_components/icons";
import { useDebouncedValue } from "~/app/_components/use-debounced-value";
import { api } from "~/trpc/react";

function compactValues(values: string[]) {
  return values.map((value) => value.trim()).filter(Boolean);
}

function DotSeparator({
  className = "text-text-disabled",
}: {
  className?: string;
}) {
  return <span className={className}>|</span>;
}

function formatSalary(
  salaryExpectation: number,
  salaryCurrency: string,
): string {
  if (!salaryExpectation) {
    return "Не указано";
  }

  const formatted = new Intl.NumberFormat("ru-RU").format(salaryExpectation);
  return salaryCurrency === "USD" ? `$${formatted}+` : `${formatted} UZS`;
}

function toAiSummaryLines(aiAnalysis: string) {
  const normalized = aiAnalysis.trim();

  if (!normalized) {
    return ["AI-анализ пока недоступен"];
  }

  const lines = normalized
    .split("\n")
    .map((line) => line.replace(/^[•\-\s]+/, "").trim())
    .filter(Boolean);

  const sourceLines =
    lines.length > 1
      ? lines
      : normalized
          .split(/(?<=[.!?])\s+/)
          .map((line) => line.replace(/^[•\-\s]+/, "").trim())
          .filter(Boolean);

  return sourceLines.slice(0, 2);
}

type FunnelCandidate = {
  id: string;
  fullName: string;
  city: string;
  experience: string;
  matchScore: number;
  aiAnalysis: string;
  currentPosition: string;
  currentCompany: string;
  contacts: {
    phone: string;
    telegram: string;
    email: string;
  };
  languages: { name: string; level: string }[];
  skills: string[];
  salaryExpectation: number;
  salaryCurrency: string;
  tags: string[];
  source: string;
  resumeUrl: string;
  relatedVacancies: { id: string; title: string }[];
};

type FunnelStage = {
  value: string;
  label: string;
  candidates: FunnelCandidate[];
};

function CandidateCardSection({
  children,
  icon,
  title,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5 text-text-placeholder">
        <span className="flex h-[14px] w-[14px] items-center justify-center">
          {icon}
        </span>
        <p className="font-medium text-[12px] leading-none tracking-[-0.24px]">
          {title}
        </p>
      </div>
      {children}
    </div>
  );
}

function VacancyFunnelHeader({
  areaId,
  experienceId,
  id,
  title,
}: {
  areaId: string;
  experienceId: string;
  id: string;
  title: string;
}) {
  const metadata = [experienceId, areaId].filter(
    (value) => value.trim().length > 0,
  );

  return (
    <section className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
      <div className="flex flex-col gap-4">
        <p className="font-medium text-[16px] text-text-secondary uppercase leading-none tracking-[-0.32px]">
          Воронка по вакансии
        </p>

        <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:gap-4">
          <h1 className="font-bold text-[28px] text-text-heading leading-none tracking-[-0.64px] md:text-[32px]">
            {title}
          </h1>

          {metadata.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 md:gap-4">
              {metadata.map((value, index) => (
                <div className="flex items-center gap-3 md:gap-4" key={value}>
                  {index > 0 && (
                    <span
                      aria-hidden="true"
                      className="hidden h-[18px] w-px bg-border-input md:block"
                    />
                  )}
                  <span className="font-medium text-[28px] text-text-secondary leading-none tracking-[-0.64px] md:text-[32px]">
                    {value}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 self-start md:self-end">
        <Link
          className="inline-flex h-9 w-full min-w-0 items-center justify-between gap-3 rounded-[6px] bg-primary-blue px-3 text-[16px] text-bg-light leading-none tracking-[-0.32px] transition-colors hover:bg-primary-blue-hover sm:w-[195px]"
          href={`/vacancies/${id}`}
        >
          <span className="font-medium">Больше о вакансии</span>
          <ChevronRightIcon className="h-3 w-3 shrink-0" />
        </Link>

        <button
          aria-label="Дополнительные действия"
          className="inline-flex h-[22px] w-[22px] items-center justify-center text-text-secondary transition-colors hover:text-text-heading"
          type="button"
        >
          <MoreIcon className="h-[18px] w-[18px]" />
        </button>
      </div>
    </section>
  );
}

function VacancyStageCandidateCard({
  candidate,
  isDragOverlay = false,
  isDragging = false,
  isHhSource,
  vacancyId,
  vacancyTitle,
}: {
  candidate: FunnelCandidate;
  isDragOverlay?: boolean;
  isDragging?: boolean;
  isHhSource?: boolean;
  vacancyId: string;
  vacancyTitle: string;
}) {
  const subtitleTokens = compactValues([
    candidate.city.toUpperCase(),
    candidate.experience.toUpperCase(),
  ]);
  const aiSummaryLines = toAiSummaryLines(candidate.aiAnalysis);
  const positionTokens = compactValues([
    candidate.currentCompany,
    candidate.currentPosition,
    ...candidate.languages
      .slice(0, 1)
      .map((language) =>
        language.level ? `${language.name} ${language.level}` : language.name,
      ),
    ...candidate.skills.slice(0, 1),
  ]);
  const contactTokens = compactValues([
    candidate.contacts.phone,
    candidate.contacts.telegram,
    candidate.contacts.email,
  ]);
  const candidateDetailId = isHhSource ? `hh_${candidate.id}` : candidate.id;
  const candidateDetailParams = new URLSearchParams({
    fromVacancyId: vacancyId,
    fromVacancyTitle: vacancyTitle,
  });
  const candidateDetailHref = `/candidates/${candidateDetailId}?${candidateDetailParams.toString()}`;

  return (
    <article
      className={`flex w-full flex-col gap-6 rounded-[8px] border border-border-input bg-bg-light p-4 md:w-[293px] ${
        isDragging ? "opacity-40" : ""
      } ${isDragOverlay ? "rotate-2 cursor-grabbing shadow-2xl" : ""}`}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-wrap items-center gap-[5px] text-[12px] text-text-placeholder uppercase leading-[1.3] tracking-[-0.24px]">
              {subtitleTokens.length > 0 ? (
                subtitleTokens.map((token, index) => (
                  <div className="flex items-center gap-[5px]" key={token}>
                    {index > 0 ? (
                      <DotSeparator className="text-text-placeholder" />
                    ) : null}
                    <span className="font-medium">{token}</span>
                  </div>
                ))
              ) : (
                <span className="font-medium">Кандидат</span>
              )}
            </div>

            <button
              aria-label="Дополнительные действия по кандидату"
              className="inline-flex h-4 w-4 items-center justify-center text-text-secondary transition-colors hover:text-text-heading"
              type="button"
            >
              <MoreIcon className="h-4 w-4" />
            </button>
          </div>

          <Link
            className={`font-semibold text-[16px] leading-[1.1] tracking-[-0.32px] transition-colors ${
              isHhSource
                ? "text-primary-blue hover:text-primary-blue-hover"
                : "text-text-heading hover:text-primary-blue"
            }`}
            href={candidateDetailHref}
          >
            {candidate.fullName}
          </Link>
        </div>

        <div className="rounded-[5px] bg-status-offer-bg p-2 text-status-offer">
          <div className="mb-[9px] flex items-center gap-1.5">
            <div className="flex items-center gap-1">
              <AIGenerationIcon className="h-3 w-3" />
              <span className="font-bold text-[12px] leading-none tracking-[-0.24px]">
                AI
              </span>
            </div>
            <span className="font-semibold text-[12px] leading-none tracking-[-0.24px]">
              {candidate.matchScore}% соответствия
            </span>
          </div>

          <div className="flex flex-col gap-1">
            {aiSummaryLines.map((line) => (
              <p
                className="text-[12px] leading-[1.3] tracking-[-0.24px]"
                key={line}
              >
                - {line}
              </p>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <CandidateCardSection
          icon={<OutlineBriefcaseIcon className="h-[14px] w-[14px]" />}
          title="Текущая должность и навыки"
        >
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] text-text-heading leading-[1.3] tracking-[-0.28px]">
            {positionTokens.length > 0 ? (
              positionTokens.map((token, index) => (
                <div className="flex items-center gap-2" key={token}>
                  {index > 0 ? <DotSeparator /> : null}
                  <span>{token}</span>
                </div>
              ))
            ) : (
              <span className="text-text-placeholder">Нет данных</span>
            )}
          </div>
        </CandidateCardSection>

        <CandidateCardSection
          icon={<MailIcon className="h-[14px] w-[14px]" />}
          title="Контакты"
        >
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] text-text-heading leading-[1.3] tracking-[-0.28px]">
            {contactTokens.length > 0 ? (
              contactTokens.map((token, index) => (
                <div className="flex items-center gap-2" key={token}>
                  {index > 0 ? <DotSeparator /> : null}
                  <span>{token}</span>
                </div>
              ))
            ) : (
              <span className="text-text-placeholder">Нет данных</span>
            )}
          </div>
        </CandidateCardSection>

        <CandidateCardSection
          icon={<DollarIcon className="h-[14px] w-[14px]" />}
          title="Зарплатные ожидания"
        >
          <p className="text-[14px] text-text-heading leading-[1.3] tracking-[-0.28px]">
            {formatSalary(
              candidate.salaryExpectation,
              candidate.salaryCurrency,
            )}
          </p>
        </CandidateCardSection>

        <CandidateCardSection
          icon={<VacancyResponsesIcon className="h-[14px] w-[14px]" />}
          title="Отклики на другие вакансии"
        >
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] leading-[1.3] tracking-[-0.28px]">
            {candidate.relatedVacancies.length > 0 ? (
              candidate.relatedVacancies.slice(0, 2).map((vacancy, index) => (
                <div className="flex items-center gap-2" key={vacancy.id}>
                  {index > 0 ? <DotSeparator /> : null}
                  <Link
                    className="text-primary-blue transition-colors hover:text-primary-blue-hover"
                    href={`/vacancies/${vacancy.id}`}
                  >
                    {vacancy.title}
                  </Link>
                </div>
              ))
            ) : (
              <span className="text-text-placeholder">Нет откликов</span>
            )}
          </div>
        </CandidateCardSection>
      </div>

      {candidate.tags.length > 0 ? (
        <div className="flex flex-wrap items-start gap-[6px]">
          {candidate.tags.slice(0, 3).map((tag) => (
            <div className="rounded-[6px] bg-status-danger-soft p-2" key={tag}>
              <p className="font-semibold text-[12px] text-accent-red uppercase leading-none tracking-[-0.24px] line-through">
                {tag}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      <p className="text-[12px] text-text-heading leading-[1.3] tracking-[-0.24px]">
        Источник:{" "}
        <span className="text-primary-blue">
          {candidate.source.trim() || "Не указан"}
        </span>
      </p>

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-1 text-text-placeholder">
          <DownloadIcon className="h-[18px] w-[18px]" />
          <p className="font-medium text-[16px] leading-none tracking-[-0.32px]">
            CV
          </p>
        </div>

        <button
          className="inline-flex h-[34px] items-center justify-center rounded-[6px] bg-primary-blue-light px-3 font-medium text-[14px] text-primary-blue leading-none tracking-[-0.28px] transition-colors hover:bg-primary-blue-light-hover disabled:cursor-not-allowed disabled:text-text-disabled"
          disabled={!candidate.resumeUrl}
          onClick={() => {
            if (candidate.resumeUrl) {
              window.open(candidate.resumeUrl, "_blank", "noopener,noreferrer");
            }
          }}
          type="button"
        >
          Быстрый просмотр CV
        </button>
      </div>
    </article>
  );
}

function DraggableCandidateCard({
  activeCandidateId,
  candidate,
  disabled,
  isHhSource,
  stageValue,
  vacancyId,
  vacancyTitle,
}: {
  activeCandidateId: string | null;
  candidate: FunnelCandidate;
  disabled: boolean;
  isHhSource?: boolean;
  stageValue: string;
  vacancyId: string;
  vacancyTitle: string;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: candidate.id,
      disabled,
      data: { stageValue },
    });

  const style = {
    transform: CSS.Translate.toString(transform),
    touchAction: disabled ? undefined : ("none" as const),
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={disabled ? "" : "cursor-grab active:cursor-grabbing"}
    >
      <VacancyStageCandidateCard
        candidate={candidate}
        isDragging={isDragging || activeCandidateId === candidate.id}
        isHhSource={isHhSource}
        vacancyId={vacancyId}
        vacancyTitle={vacancyTitle}
      />
    </div>
  );
}

function VacancyStageSection({
  activeCandidateId,
  candidates,
  canAddCandidate,
  isDndDisabled,
  isHhSource,
  label,
  onAddCandidate,
  stageValue,
  vacancyId,
  vacancyTitle,
}: {
  activeCandidateId: string | null;
  candidates: FunnelCandidate[];
  canAddCandidate: boolean;
  isDndDisabled: boolean;
  isHhSource?: boolean;
  label: string;
  onAddCandidate: () => void;
  stageValue: string;
  vacancyId: string;
  vacancyTitle: string;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: stageValue,
    disabled: isDndDisabled,
    data: { stageValue },
  });

  return (
    <section
      className={`w-full shrink-0 rounded-[8px] border bg-bg-input p-4 transition-colors lg:w-[325px] ${
        isOver
          ? "border-primary-blue bg-primary-blue-light"
          : "border-border-input"
      }`}
      ref={setNodeRef}
    >
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-medium text-[16px] text-text-secondary leading-none tracking-[-0.32px]">
          {label}
        </h2>

        <div className="flex items-center gap-2">
          {canAddCandidate ? (
            <button
              aria-label={`Добавить кандидата в этап ${label}`}
              className="inline-flex h-5 w-5 items-center justify-center text-primary-blue transition-colors hover:text-primary-blue-hover"
              onClick={onAddCandidate}
              type="button"
            >
              <PlusIcon className="h-5 w-5" />
            </button>
          ) : null}
          <button
            aria-label={`Сортировка кандидатов этапа ${label}`}
            className="inline-flex h-4 w-4 items-center justify-center text-text-secondary transition-colors hover:text-text-heading"
            type="button"
          >
            <SortIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-4">
        {candidates.length === 0 ? (
          <div className="rounded-[8px] border border-border-input bg-bg-light px-4 py-6 text-[14px] text-text-secondary">
            На этом этапе пока нет кандидатов.
          </div>
        ) : (
          candidates.map((candidate) => (
            <DraggableCandidateCard
              activeCandidateId={activeCandidateId}
              candidate={candidate}
              disabled={isDndDisabled}
              isHhSource={isHhSource}
              key={candidate.id}
              stageValue={stageValue}
              vacancyId={vacancyId}
              vacancyTitle={vacancyTitle}
            />
          ))
        )}
      </div>
    </section>
  );
}

export default function VacancyFunnelPage() {
  const { id } = useParams() as { id: string };
  const utils = api.useUtils();
  const [assignmentStage, setAssignmentStage] = useState<{
    label: string;
    value: string;
  } | null>(null);
  const { data, isLoading } = api.vacancies.getFunnel.useQuery(
    { id },
    { enabled: Boolean(id) },
  );
  const isHhVacancy = data?.source === "hh.uz";
  const [localStages, setLocalStages] = useState<FunnelStage[] | null>(null);
  const [activeCandidateId, setActiveCandidateId] = useState<string | null>(
    null,
  );
  const previousStagesRef = useRef<FunnelStage[] | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebouncedValue(searchQuery.trim(), 300);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<FilterModalFilters>(
    EMPTY_FILTER_MODAL_FILTERS,
  );
  const { data: lookups } = api.lookups.getCandidateCreateOptions.useQuery();
  const { data: vacancyLookups } =
    api.lookups.getVacancyCreateOptions.useQuery();
  const statusOptions = useMemo(
    () => lookups?.statusOptions ?? [],
    [lookups?.statusOptions],
  );
  const activeFilterCount = countActiveFilters(appliedFilters);

  useEffect(() => {
    if (data?.stages) {
      setLocalStages(data.stages);
    }
  }, [data?.stages]);

  const assignCandidateToVacancy = api.vacancies.assignCandidate.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.vacancies.getFunnel.invalidate({ id }),
        utils.vacancies.searchCandidates.invalidate({
          vacancyId: id,
          limit: 8,
          offset: 0,
          query: "",
        }),
      ]);
      setAssignmentStage(null);
    },
  });

  const moveCandidateMutation = api.vacancies.assignCandidate.useMutation({
    onSuccess: async () => {
      await utils.vacancies.getFunnel.invalidate({ id });
    },
    onError: () => {
      if (previousStagesRef.current) {
        setLocalStages(previousStagesRef.current);
      }
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const stages = localStages ?? data?.stages ?? [];
  const displayStages = useMemo<FunnelStage[]>(() => {
    const normalizedQuery = debouncedSearchQuery.toLowerCase();
    const cityFilter = appliedFilters.city.trim().toLowerCase();
    const sourcesFilter = appliedFilters.sources;
    const statusesFilter = appliedFilters.statuses;

    return stages
      .filter(
        (stage) =>
          statusesFilter.length === 0 || statusesFilter.includes(stage.value),
      )
      .map((stage) => {
        const filtered = stage.candidates.filter((candidate) => {
          if (normalizedQuery) {
            const haystack = [
              candidate.fullName,
              candidate.currentPosition,
              candidate.currentCompany,
            ]
              .join(" ")
              .toLowerCase();
            if (!haystack.includes(normalizedQuery)) {
              return false;
            }
          }
          if (cityFilter && !candidate.city.toLowerCase().includes(cityFilter)) {
            return false;
          }
          if (
            sourcesFilter.length > 0 &&
            !sourcesFilter.includes(candidate.source)
          ) {
            return false;
          }
          return true;
        });

        const sorted = [...filtered].sort(
          (a, b) => b.matchScore - a.matchScore,
        );

        return { ...stage, candidates: sorted };
      });
  }, [
    stages,
    debouncedSearchQuery,
    appliedFilters.city,
    appliedFilters.sources,
    appliedFilters.statuses,
  ]);
  const activeCandidate = useMemo<FunnelCandidate | null>(() => {
    if (!activeCandidateId) {
      return null;
    }
    for (const stage of stages) {
      const found = stage.candidates.find(
        (candidate) => candidate.id === activeCandidateId,
      );
      if (found) {
        return found;
      }
    }
    return null;
  }, [activeCandidateId, stages]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveCandidateId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveCandidateId(null);
    const { active, over } = event;
    if (!over) {
      return;
    }
    const candidateId = String(active.id);
    const targetStageValue = String(over.id);
    const sourceStageValue = (
      active.data.current as { stageValue?: string } | undefined
    )?.stageValue;
    if (!sourceStageValue || sourceStageValue === targetStageValue) {
      return;
    }

    const baseline = localStages ?? data?.stages ?? [];
    let candidate: FunnelCandidate | undefined;
    const withoutCandidate = baseline.map((stage) => {
      if (stage.value !== sourceStageValue) {
        return stage;
      }
      const remaining = stage.candidates.filter((current) => {
        if (current.id === candidateId) {
          candidate = current;
          return false;
        }
        return true;
      });
      return { ...stage, candidates: remaining };
    });

    if (!candidate) {
      return;
    }

    const moved = candidate;
    const nextStages = withoutCandidate.map((stage) =>
      stage.value === targetStageValue
        ? { ...stage, candidates: [...stage.candidates, moved] }
        : stage,
    );

    previousStagesRef.current = baseline;
    setLocalStages(nextStages);

    moveCandidateMutation.mutate({
      candidateId,
      status: targetStageValue,
      vacancyId: id,
    });
  };

  const handleCloseAssignmentModal = () => {
    if (assignCandidateToVacancy.isPending) {
      return;
    }

    setAssignmentStage(null);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-light">
        <div className="text-text-secondary">Загрузка...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-light">
        <div className="text-text-secondary">Воронка вакансии не найдена</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-bg-light px-6 pt-8 pb-8">
      <div className="mx-auto flex w-full max-w-[1132px] flex-col gap-6">
        <Breadcrumbs
          label={`${data.title} / Воронка`}
          rootHref="/vacancies"
          rootLabel="Вакансии"
        />

        <VacancyFunnelHeader
          areaId={data.areaId}
          experienceId={data.experienceId}
          id={data.id}
          title={data.title}
        />

        {isHhVacancy ? (
          <div className="rounded-[8px] border border-border-input bg-bg-input px-4 py-3 text-[14px] text-text-secondary">
            Кандидаты и этапы загружены из hh.uz. Добавление кандидатов в
            воронку на этой странице недоступно.
          </div>
        ) : null}

        {data.hhAccessDenied ? (
          <div className="rounded-[8px] border border-danger-red-bg bg-danger-red-bg px-4 py-3 text-[14px] text-danger-red">
            У вашего аккаунта hh.uz нет доступа к откликам этой вакансии.
            Кандидаты с hh.uz не отображаются в воронке. Проверьте права
            менеджера или подключённый аккаунт hh.uz.
          </div>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <SearchIcon className="absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-text-placeholder" />
            <input
              className="w-full rounded-xl border border-border-light bg-bg-light py-3 pr-4 pl-12 text-text-label placeholder:text-text-placeholder focus:border-primary-blue focus:outline-none focus:ring-2 focus:ring-primary-blue/20"
              onChange={(event) => setSearchQuery(event.target.value)}
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

        <DndContext
          collisionDetection={pointerWithin}
          onDragEnd={handleDragEnd}
          onDragStart={handleDragStart}
          sensors={sensors}
        >
          <div className="flex gap-4 overflow-x-auto pb-2">
            {displayStages.map((stage) => (
              <VacancyStageSection
                activeCandidateId={activeCandidateId}
                canAddCandidate={!isHhVacancy}
                candidates={stage.candidates}
                isDndDisabled={isHhVacancy}
                isHhSource={isHhVacancy}
                key={stage.value}
                label={stage.label}
                onAddCandidate={() =>
                  setAssignmentStage({
                    label: stage.label,
                    value: stage.value,
                  })
                }
                stageValue={stage.value}
                vacancyId={data.id}
                vacancyTitle={data.title}
              />
            ))}
          </div>
          <DragOverlay>
            {activeCandidate ? (
              <VacancyStageCandidateCard
                candidate={activeCandidate}
                isDragOverlay
                isHhSource={isHhVacancy}
                vacancyId={data.id}
                vacancyTitle={data.title}
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      <FilterModal
        cityOptions={vacancyLookups?.cities}
        initialFilters={appliedFilters}
        isOpen={isFilterModalOpen}
        onApply={(filters) => {
          setAppliedFilters(filters);
          setIsFilterModalOpen(false);
        }}
        onClose={() => setIsFilterModalOpen(false)}
        sourceOptions={lookups?.sources}
        statusOptions={statusOptions}
      />

      <AssignCandidateToVacancyModal
        errorMessage={assignCandidateToVacancy.error?.message}
        isAssigning={assignCandidateToVacancy.isPending}
        isOpen={assignmentStage !== null && !isHhVacancy}
        onAssignCandidate={(candidateId) => {
          if (!assignmentStage) {
            return;
          }

          assignCandidateToVacancy.mutate({
            candidateId,
            status: assignmentStage.value,
            vacancyId: id,
          });
        }}
        onClose={handleCloseAssignmentModal}
        stageLabel={assignmentStage?.label ?? ""}
        vacancyId={id}
      />
    </main>
  );
}
