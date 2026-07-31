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
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { AssignCandidateToVacancyModal } from "~/app/_components/assign-candidate-to-vacancy-modal";
import {
  countActiveFilters,
  EMPTY_FILTER_MODAL_FILTERS,
  FilterModal,
  type FilterModalFilters,
} from "~/app/_components/filter-modal";
import {
  AIGenerationIcon,
  ChevronRightIcon,
  DownloadIcon,
  FilterIcon,
  MoreIcon,
  PlusIcon,
  SearchIcon,
  SortIcon,
} from "~/app/_components/icons";
import {
  FeedbackPresence,
  LoadingState,
} from "~/app/_components/motion-system";
import { useDebouncedValue } from "~/app/_components/use-debounced-value";
import { useLookupLocalizer } from "~/i18n/use-localized-lookups";
import { api } from "~/trpc/react";
import { PublicationsTable } from "../publications-table";

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

function toAiSummaryLines(aiAnalysis: string, fallback: string) {
  const normalized = aiAnalysis.trim();

  if (!normalized) {
    return [fallback];
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
  matchAnalysis: string;
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
  total: number;
  limit: number;
  offset: number;
};

const FUNNEL_PAGE_SIZE = 10;

type FunnelSection = "candidates" | "description" | "publications";

function VacancyFunnelHeader({
  activeSection,
  areaId,
  candidateCount,
  experienceId,
  id,
  onSectionChange,
  title,
}: {
  activeSection: FunnelSection;
  areaId: string;
  candidateCount: number;
  experienceId: string;
  id: string;
  onSectionChange: (section: FunnelSection) => void;
  title: string;
}) {
  const t = useTranslations("Funnel");
  const vacancyDetailT = useTranslations("VacancyDetail");
  const metadata = [experienceId, areaId].filter(
    (value) => value.trim().length > 0,
  );

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:gap-4">
          <h1 className="page-title">{title}</h1>

          {metadata.length > 0 ? (
            <div className="flex flex-wrap items-center gap-3 md:gap-4">
              {metadata.map((value) => (
                <div className="flex items-center gap-3 md:gap-4" key={value}>
                  <span
                    aria-hidden="true"
                    className="hidden h-[24px] w-px bg-border-input md:block"
                  />
                  <span className="font-medium text-3xl text-text-secondary leading-none md:text-3xl">
                    {value}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <Link
            className="ui-button w-full justify-between bg-action-soft-bg text-primary-blue hover:bg-action-soft-bg-hover sm:w-auto sm:min-w-48"
            href={`/vacancies/${id}`}
          >
            <span className="font-medium">{t("moreAboutVacancy")}</span>
            <ChevronRightIcon className="h-3 w-3 shrink-0" />
          </Link>

          <button
            aria-label={t("moreActions")}
            className="inline-flex h-[22px] w-[22px] items-center justify-center text-text-secondary transition-colors hover:text-text-heading"
            type="button"
          >
            <MoreIcon className="h-[18px] w-[18px]" />
          </button>
        </div>
      </section>

      <div
        aria-label={t("vacancySections")}
        className="flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-xl bg-bg-input p-1"
        role="tablist"
      >
        <button
          aria-controls="funnel-panel-candidates"
          aria-selected={activeSection === "candidates"}
          className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 font-semibold text-sm transition-[background-color,color,box-shadow] duration-200 ease-out ${
            activeSection === "candidates"
              ? "bg-bg-light text-text-heading shadow-sm"
              : "text-text-secondary hover:bg-bg-panel-hover hover:text-text-heading"
          }`}
          id="funnel-tab-candidates"
          onClick={() => onSectionChange("candidates")}
          role="tab"
          type="button"
        >
          {t("candidatesTab")}
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-badge-red px-1.5 font-semibold text-bg-light text-xs">
            {candidateCount}
          </span>
        </button>
        <button
          aria-controls="funnel-panel-description"
          aria-selected={activeSection === "description"}
          className={`shrink-0 rounded-lg px-3 py-2 font-medium text-sm transition-[background-color,color,box-shadow] duration-200 ease-out ${
            activeSection === "description"
              ? "bg-bg-light text-text-heading shadow-sm"
              : "text-text-secondary hover:bg-bg-panel-hover hover:text-text-heading"
          }`}
          id="funnel-tab-description"
          onClick={() => onSectionChange("description")}
          role="tab"
          type="button"
        >
          {vacancyDetailT("descriptionMenu")}
        </button>
        <button
          aria-controls="funnel-panel-publications"
          aria-selected={activeSection === "publications"}
          className={`shrink-0 rounded-lg px-3 py-2 font-medium text-sm transition-[background-color,color,box-shadow] duration-200 ease-out ${
            activeSection === "publications"
              ? "bg-bg-light text-text-heading shadow-sm"
              : "text-text-secondary hover:bg-bg-panel-hover hover:text-text-heading"
          }`}
          id="funnel-tab-publications"
          onClick={() => onSectionChange("publications")}
          role="tab"
          type="button"
        >
          {vacancyDetailT("publicationsMenu")}
        </button>
      </div>
    </div>
  );
}

function VacancyDescriptionPanel({ vacancyId }: { vacancyId: string }) {
  const format = useFormatter();
  const t = useTranslations("Funnel");
  const vacancyFormT = useTranslations("VacancyForm");
  const { data: vacancy, isLoading } = api.vacancies.get.useQuery(
    { id: vacancyId },
    { enabled: Boolean(vacancyId) },
  );

  if (isLoading) {
    return (
      <div className="surface-card flex min-h-48 items-center justify-center p-6">
        <LoadingState compact label={t("loadingDescription")} />
      </div>
    );
  }

  if (!vacancy) {
    return (
      <div className="surface-card p-6 text-sm text-text-secondary">
        {t("descriptionUnavailable")}
      </div>
    );
  }

  const salaryValues = [vacancy.salaryFrom, vacancy.salaryTo].filter(
    (value): value is number => typeof value === "number",
  );
  const salary =
    salaryValues.length > 0
      ? `${salaryValues.map((value) => format.number(value)).join(" — ")} ${
          vacancy.salaryCurrency ?? "UZS"
        }`
      : t("notSpecified");
  const descriptionHtml = vacancy.descriptionHtml?.trim() ?? "";

  return (
    <section className="surface-card overflow-hidden">
      <div className="border-border-light border-b p-5 sm:p-6">
        <h2 className="section-title">{vacancyFormT("description")}</h2>
        {descriptionHtml ? (
          <div
            className="mt-4 text-sm text-text-secondary leading-[1.65] [&_a]:text-primary-blue [&_a]:underline [&_h1]:mb-3 [&_h1]:font-semibold [&_h1]:text-base [&_h1]:text-text-heading [&_h2]:mb-3 [&_h2]:font-semibold [&_h2]:text-base [&_h2]:text-text-heading [&_li]:mb-1 [&_ol]:ml-5 [&_ol]:list-decimal [&_p]:mb-3 [&_ul]:ml-5 [&_ul]:list-disc"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: descriptionHtml is authored by the company in the vacancy editor
            dangerouslySetInnerHTML={{ __html: descriptionHtml }}
          />
        ) : (
          <p className="mt-4 text-sm text-text-placeholder">
            {t("descriptionEmpty")}
          </p>
        )}
      </div>

      <div className="p-5 sm:p-6">
        <h2 className="section-title">{vacancyFormT("conditions")}</h2>
        <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg bg-bg-input p-4">
            <dt className="font-medium text-text-placeholder text-xs uppercase tracking-[0.08em]">
              {t("salary")}
            </dt>
            <dd className="mt-2 font-semibold text-sm text-text-heading">
              {salary}
            </dd>
          </div>
          <div className="rounded-lg bg-bg-input p-4">
            <dt className="font-medium text-text-placeholder text-xs uppercase tracking-[0.08em]">
              {vacancyFormT("contactPhone")}
            </dt>
            <dd className="mt-2 font-semibold text-sm text-text-heading">
              {vacancy.contactPhone?.trim() || t("notSpecified")}
            </dd>
          </div>
        </dl>
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
  const t = useTranslations("Funnel");
  const subtitleTokens = compactValues([
    candidate.city.toUpperCase(),
    candidate.experience.toUpperCase(),
  ]);
  // Per-vacancy fit narrative (candidateVacancies.matchAnalysis) when present;
  // older rows that predate it fall back to the candidate-level résumé summary.
  const aiSummaryLines = toAiSummaryLines(
    candidate.matchAnalysis || candidate.aiAnalysis,
    t("aiUnavailable"),
  );
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
  const candidateDetailId = isHhSource ? `hh_${candidate.id}` : candidate.id;
  const candidateDetailParams = new URLSearchParams({
    fromVacancyId: vacancyId,
    fromVacancyTitle: vacancyTitle,
  });
  const candidateDetailHref = `/candidates/${candidateDetailId}?${candidateDetailParams.toString()}`;

  return (
    <article
      className={`surface-card flex w-full flex-col gap-4 p-4 hover:border-border-control hover:shadow-menu motion-safe:hover:-translate-y-0.5 md:w-72 ${
        isDragging ? "opacity-40" : ""
      } ${isDragOverlay ? "rotate-2 cursor-grabbing shadow-2xl" : ""}`}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-wrap items-center gap-1.5 text-text-placeholder text-xs uppercase leading-[1.3]">
              {subtitleTokens.length > 0 ? (
                subtitleTokens.map((token, index) => (
                  <div className="flex items-center gap-1.5" key={token}>
                    {index > 0 ? (
                      <DotSeparator className="text-text-placeholder" />
                    ) : null}
                    <span className="font-medium">{token}</span>
                  </div>
                ))
              ) : (
                <span className="font-medium">{t("candidate")}</span>
              )}
            </div>

            <button
              aria-label={t("candidateActions")}
              className="inline-flex h-4 w-4 items-center justify-center text-text-secondary transition-colors hover:text-text-heading"
              type="button"
            >
              <MoreIcon className="h-4 w-4" />
            </button>
          </div>

          <Link
            className="font-semibold text-base text-text-heading leading-[1.1] transition-colors hover:text-primary-blue"
            href={candidateDetailHref}
          >
            {candidate.fullName}
          </Link>
        </div>

        <div
          className="rounded-md bg-ai-analysis-bg p-2 text-text-heading"
          data-testid="funnel-ai-analysis"
        >
          <div className="mb-2 flex items-center gap-1.5">
            <div className="flex items-center gap-1 text-accent-pink">
              <AIGenerationIcon className="h-3 w-3" />
              <span className="font-bold text-xs leading-none">AI</span>
            </div>
            <span className="font-semibold text-xs leading-none">
              {t("match", { score: candidate.matchScore })}
            </span>
          </div>

          <div className="flex flex-col gap-1">
            {aiSummaryLines.map((line) => (
              <p
                className="flex items-start gap-1.5 text-text-secondary text-xs leading-[1.3]"
                key={line}
              >
                <span
                  aria-hidden="true"
                  className="font-bold text-success-green"
                >
                  +
                </span>
                <span>{line}</span>
              </p>
            ))}
          </div>
        </div>
      </div>

      {positionTokens.length > 0 ? (
        <div className="flex flex-wrap items-start gap-1.5">
          {positionTokens.slice(0, 4).map((token) => (
            <span
              className="rounded-lg bg-badge-soft-green-bg px-2 py-1.5 font-semibold text-text-heading text-xs uppercase leading-none"
              data-testid="funnel-skill-badge"
              key={token}
            >
              ✓ {token}
            </span>
          ))}
        </div>
      ) : null}

      {candidate.tags.length > 0 ? (
        <div className="flex flex-wrap items-start gap-1.5">
          {candidate.tags.slice(0, 3).map((tag) => (
            <div className="rounded-lg bg-status-danger-soft p-2" key={tag}>
              <p className="font-semibold text-accent-red text-xs uppercase leading-none line-through">
                {tag}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-4 border-border-light border-t pt-3">
        <div className="flex items-center gap-1 text-text-placeholder">
          <DownloadIcon className="h-[18px] w-[18px]" />
          <p className="font-medium text-base leading-none">CV</p>
        </div>

        <button
          className="inline-flex h-[34px] items-center justify-center rounded-lg bg-action-soft-bg px-3 font-medium text-primary-blue text-sm leading-none transition-colors hover:bg-action-soft-bg-hover disabled:cursor-not-allowed disabled:text-text-disabled"
          data-testid="funnel-cv-button"
          disabled={!candidate.resumeUrl}
          onClick={() => {
            if (candidate.resumeUrl) {
              window.open(candidate.resumeUrl, "_blank", "noopener,noreferrer");
            }
          }}
          type="button"
        >
          {t("quickCv")}
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
  isLoadingMore,
  label,
  onAddCandidate,
  onLoadMore,
  stageValue,
  total,
  vacancyId,
  vacancyTitle,
}: {
  activeCandidateId: string | null;
  candidates: FunnelCandidate[];
  canAddCandidate: boolean;
  isDndDisabled: boolean;
  isHhSource?: boolean;
  isLoadingMore: boolean;
  label: string;
  onAddCandidate: () => void;
  onLoadMore: () => void;
  stageValue: string;
  total: number;
  vacancyId: string;
  vacancyTitle: string;
}) {
  const t = useTranslations("Funnel");
  const remainingCandidateCount = Math.max(0, total - candidates.length);
  const nextCandidateCount = Math.min(
    FUNNEL_PAGE_SIZE,
    remainingCandidateCount,
  );
  const { isOver, setNodeRef } = useDroppable({
    id: stageValue,
    disabled: isDndDisabled,
    data: { stageValue },
  });

  return (
    <section
      className={`w-full shrink-0 rounded-xl border p-4 transition-[background-color,border-color,box-shadow] duration-200 ease-out lg:w-80 ${
        isOver
          ? "border-primary-blue bg-action-soft-bg shadow-menu"
          : "border-transparent bg-bg-input"
      }`}
      data-testid="funnel-stage"
      ref={setNodeRef}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-baseline gap-2">
          <h2 className="truncate font-semibold text-base text-text-heading leading-none">
            {label}
          </h2>
          <span className="font-medium text-sm text-text-placeholder leading-none">
            {total}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {canAddCandidate ? (
            <button
              aria-label={t("addToStage", { stage: label })}
              className="inline-flex h-5 w-5 items-center justify-center text-primary-blue transition-colors hover:text-primary-blue-hover"
              onClick={onAddCandidate}
              type="button"
            >
              <PlusIcon className="h-5 w-5" />
            </button>
          ) : null}
          <button
            aria-label={t("sortStage", { stage: label })}
            className="inline-flex h-4 w-4 items-center justify-center text-text-secondary transition-colors hover:text-text-heading"
            type="button"
          >
            <SortIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-4">
        {candidates.length === 0 ? (
          <div className="rounded-lg border border-border-input bg-bg-light px-4 py-6 text-sm text-text-secondary">
            {t("emptyStage")}
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

      {remainingCandidateCount > 0 ? (
        <button
          aria-label={t("loadMoreForStage", {
            count: nextCandidateCount,
            stage: label,
          })}
          className="mt-4 inline-flex w-full items-center justify-center py-4 font-semibold text-base text-text-placeholder transition-[color,opacity,transform] duration-200 ease-out hover:text-primary-blue active:scale-[0.98] disabled:cursor-wait disabled:opacity-55"
          data-testid="funnel-load-more"
          disabled={isLoadingMore}
          onClick={onLoadMore}
          type="button"
        >
          {isLoadingMore
            ? t("loadingMore")
            : t("loadMore", { count: nextCandidateCount })}
        </button>
      ) : null}
    </section>
  );
}

export default function VacancyFunnelPage() {
  const t = useTranslations("Funnel");
  const navigationT = useTranslations("Navigation");
  const localizeLookups = useLookupLocalizer();
  const { id } = useParams() as { id: string };
  const utils = api.useUtils();
  const [activeSection, setActiveSection] =
    useState<FunnelSection>("candidates");
  const [assignmentStage, setAssignmentStage] = useState<{
    label: string;
    value: string;
  } | null>(null);
  const [localStages, setLocalStages] = useState<FunnelStage[] | null>(null);
  const [stageLimits, setStageLimits] = useState<Record<string, number>>({});
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
  const funnelInput = useMemo(
    () => ({
      id,
      search: debouncedSearchQuery || undefined,
      city: appliedFilters.city.trim() || undefined,
      sources:
        appliedFilters.sources.length > 0 ? appliedFilters.sources : undefined,
      statuses:
        appliedFilters.statuses.length > 0
          ? appliedFilters.statuses
          : undefined,
      stagePagination: Object.entries(stageLimits)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([stage, limit]) => ({
          stage,
          limit,
          offset: 0,
        })),
    }),
    [
      id,
      debouncedSearchQuery,
      appliedFilters.city,
      appliedFilters.sources,
      appliedFilters.statuses,
      stageLimits,
    ],
  );
  const { data, isFetching, isLoading } = api.vacancies.getFunnel.useQuery(
    funnelInput,
    {
      enabled: Boolean(id),
      placeholderData: (previousData) => previousData,
    },
  );
  const isHhVacancy = data?.source === "hh.uz";
  const { data: lookups } = api.lookups.getCandidateCreateOptions.useQuery();
  const { data: vacancyLookups } =
    api.lookups.getVacancyCreateOptions.useQuery();
  const statusOptions = useMemo(
    () => localizeLookups(lookups?.statusOptions, "candidateStatuses"),
    [localizeLookups, lookups?.statusOptions],
  );
  const sourceOptions = useMemo(
    () => localizeLookups(lookups?.sources, "sources"),
    [localizeLookups, lookups?.sources],
  );
  const activeFilterCount = countActiveFilters(appliedFilters);

  useEffect(() => {
    if (data?.stages) {
      setLocalStages(data.stages);
    }
  }, [data?.stages]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: changing a server-side filter resets every stage to the initial ten candidates
  useEffect(() => {
    setStageLimits({});
  }, [
    debouncedSearchQuery,
    appliedFilters.city,
    appliedFilters.sources,
    appliedFilters.statuses,
  ]);

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
  const totalCandidateCount = stages.reduce(
    (total, stage) => total + stage.total,
    0,
  );
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
      return {
        ...stage,
        candidates: remaining,
        total: Math.max(0, stage.total - 1),
      };
    });

    if (!candidate) {
      return;
    }

    const moved = candidate;
    const nextStages = withoutCandidate.map((stage) =>
      stage.value === targetStageValue
        ? {
            ...stage,
            candidates: [...stage.candidates, moved],
            total: stage.total + 1,
          }
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

  const handleSectionChange = (section: FunnelSection) => {
    setActiveSection(section);
    if (section !== "candidates") {
      setIsFilterModalOpen(false);
      setAssignmentStage(null);
      setActiveCandidateId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center bg-bg-canvas">
        <LoadingState label={t("loading")} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center bg-bg-canvas">
        <FeedbackPresence show>
          <div className="rounded-xl border border-danger-red/20 bg-danger-red-bg px-5 py-4 text-danger-red text-sm">
            {t("notFound")}
          </div>
        </FeedbackPresence>
      </div>
    );
  }

  return (
    <main className="min-h-full bg-bg-canvas">
      <div className="app-page flex flex-col gap-5">
        <nav
          aria-label={t("breadcrumb")}
          className="flex min-w-0 items-center gap-2 font-semibold text-text-placeholder text-xs uppercase tracking-[0.16em]"
        >
          <Link className="shrink-0 hover:text-text-heading" href="/vacancies">
            ← {navigationT("vacancies")}
          </Link>
          <span aria-hidden="true">·</span>
          <span className="min-w-0 truncate">{t("title")}</span>
        </nav>

        <VacancyFunnelHeader
          activeSection={activeSection}
          areaId={data.areaId}
          candidateCount={totalCandidateCount}
          experienceId={data.experienceId}
          id={data.id}
          onSectionChange={handleSectionChange}
          title={data.title}
        />

        <div
          aria-labelledby="funnel-tab-candidates"
          hidden={activeSection !== "candidates"}
          id="funnel-panel-candidates"
          role="tabpanel"
        >
          <div className="flex flex-col gap-5">
            {isHhVacancy ? (
              <div className="rounded-lg border border-border-input bg-bg-light px-4 py-3 text-sm text-text-secondary">
                {t("hhReadonly")}
              </div>
            ) : null}

            {data.hhAccessDenied ? (
              <div className="rounded-lg border border-danger-red-bg bg-danger-red-bg px-4 py-3 text-danger-red text-sm">
                {t("hhAccessDenied")}
              </div>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <SearchIcon className="absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-text-placeholder" />
                <input
                  className="ui-search"
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={t("search")}
                  type="text"
                  value={searchQuery}
                />
              </div>
              <button
                className={`ui-button border-transparent bg-action-soft-bg text-primary-blue hover:bg-action-soft-bg-hover ${
                  activeFilterCount > 0 ? "ring-1 ring-primary-blue" : ""
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
            </div>

            <DndContext
              collisionDetection={pointerWithin}
              onDragEnd={handleDragEnd}
              onDragStart={handleDragStart}
              sensors={sensors}
            >
              <div
                className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-3"
                data-testid="funnel-board"
              >
                {stages.map((stage) => {
                  const requestedLimit =
                    stageLimits[stage.value] ?? FUNNEL_PAGE_SIZE;

                  return (
                    <VacancyStageSection
                      activeCandidateId={activeCandidateId}
                      canAddCandidate={!isHhVacancy}
                      candidates={stage.candidates}
                      isDndDisabled={isHhVacancy}
                      isHhSource={isHhVacancy}
                      isLoadingMore={isFetching && requestedLimit > stage.limit}
                      key={stage.value}
                      label={stage.label}
                      onAddCandidate={() =>
                        setAssignmentStage({
                          label: stage.label,
                          value: stage.value,
                        })
                      }
                      onLoadMore={() =>
                        setStageLimits((currentLimits) => ({
                          ...currentLimits,
                          [stage.value]:
                            (currentLimits[stage.value] ?? FUNNEL_PAGE_SIZE) +
                            FUNNEL_PAGE_SIZE,
                        }))
                      }
                      stageValue={stage.value}
                      total={stage.total}
                      vacancyId={data.id}
                      vacancyTitle={data.title}
                    />
                  );
                })}
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
        </div>

        <div
          aria-labelledby="funnel-tab-description"
          hidden={activeSection !== "description"}
          id="funnel-panel-description"
          role="tabpanel"
        >
          <VacancyDescriptionPanel vacancyId={data.id} />
        </div>

        <div
          aria-labelledby="funnel-tab-publications"
          hidden={activeSection !== "publications"}
          id="funnel-panel-publications"
          role="tabpanel"
        >
          <div className="surface-card p-4 sm:p-6">
            <PublicationsTable />
          </div>
        </div>
      </div>

      <FilterModal
        cityOptions={vacancyLookups?.cities}
        initialFilters={appliedFilters}
        isOpen={activeSection === "candidates" && isFilterModalOpen}
        onApply={(filters) => {
          setAppliedFilters(filters);
          setIsFilterModalOpen(false);
        }}
        onClose={() => setIsFilterModalOpen(false)}
        sourceOptions={sourceOptions}
        statusOptions={statusOptions}
      />

      <AssignCandidateToVacancyModal
        errorMessage={assignCandidateToVacancy.error?.message}
        isAssigning={assignCandidateToVacancy.isPending}
        isOpen={
          activeSection === "candidates" &&
          assignmentStage !== null &&
          !isHhVacancy
        }
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
