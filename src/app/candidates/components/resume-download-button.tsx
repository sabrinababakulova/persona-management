"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import {
  AIGenerationIcon,
  CheckIcon,
  ChevronDownIcon,
  DownloadIcon,
  FileOutlineIcon,
} from "~/app/_components/icons";
import { Modal } from "~/app/_components/modal";
import {
  FeedbackPresence,
  LoadingButtonContent,
} from "~/app/_components/motion-system";
import { api } from "~/trpc/react";

type ExportFormat = "pdf" | "docx";
type DownloadKey = string;

const DESIGN_LABELS: Record<string, string> = {
  "person-hunters": "Person Hunters",
};

const PERSON_HUNTERS_DESIGN = "person-hunters";

const DEFAULT_ORDER = [
  "experience",
  "dateOfBirth",
  "languages",
  "education",
  "workExperience",
  "additionalInfo",
  "salary",
] as const;

type SectionKey = (typeof DEFAULT_ORDER)[number];

const ASSESSMENT_FIELDS = [
  "willSucceed",
  "motivators",
  "strengths",
  "willNotSucceed",
  "demotivators",
  "developmentAreas",
] as const;

type AssessmentField = (typeof ASSESSMENT_FIELDS)[number];
type AssessmentValues = Record<AssessmentField, string>;

const EMPTY_ASSESSMENT: AssessmentValues = {
  willSucceed: "",
  motivators: "",
  strengths: "",
  willNotSucceed: "",
  demotivators: "",
  developmentAreas: "",
};

async function downloadFromUrl(
  url: string,
  fileName: string,
  fallbackError: string,
  init?: RequestInit,
) {
  const response = await fetch(url, init);
  if (!response.ok) {
    let message = `${fallbackError} (${response.status})`;
    try {
      const data = (await response.json()) as { error?: string };
      if (data?.error) {
        message = data.error;
      }
    } catch {
      // Keep the HTTP status when the server did not return JSON.
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

function GripIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="currentColor"
      height="16"
      viewBox="0 0 16 16"
      width="16"
    >
      <circle cx="6" cy="4" r="1.3" />
      <circle cx="10" cy="4" r="1.3" />
      <circle cx="6" cy="8" r="1.3" />
      <circle cx="10" cy="8" r="1.3" />
      <circle cx="6" cy="12" r="1.3" />
      <circle cx="10" cy="12" r="1.3" />
    </svg>
  );
}

function SortableSectionRow({
  id,
  label,
  dragLabel,
  checked,
  onToggle,
}: {
  id: string;
  label: string;
  dragLabel: string;
  checked: boolean;
  onToggle: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  return (
    <li
      className={`flex items-center gap-2 rounded-lg border border-border-input bg-bg-light px-2.5 py-2.5 ${
        isDragging ? "opacity-70 shadow-md" : ""
      }`}
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <button
        aria-label={dragLabel}
        className="cursor-grab touch-none text-text-placeholder hover:text-text-secondary"
        type="button"
        {...attributes}
        {...listeners}
      >
        <GripIcon />
      </button>
      <label className="flex flex-1 cursor-pointer items-center gap-2.5 text-sm text-text-heading">
        <input
          checked={checked}
          className="h-4 w-4 accent-primary-blue"
          onChange={onToggle}
          type="checkbox"
        />
        {label}
      </label>
    </li>
  );
}

function FormatToggle({
  value,
  onChange,
  disabled,
}: {
  value: ExportFormat;
  onChange: (format: ExportFormat) => void;
  disabled: boolean;
}) {
  return (
    <div className="inline-flex rounded-xl border border-border-input bg-bg-input p-1">
      {(["pdf", "docx"] as const).map((format) => (
        <button
          aria-pressed={value === format}
          className={`min-w-14 rounded-lg px-3 py-1.5 font-semibold text-xs transition-colors ${
            value === format
              ? "bg-bg-light text-text-heading shadow-sm"
              : "text-text-secondary hover:text-text-heading"
          }`}
          disabled={disabled}
          key={format}
          onClick={() => onChange(format)}
          type="button"
        >
          {format === "pdf" ? "PDF" : "Word"}
        </button>
      ))}
    </div>
  );
}

function FieldTextarea({
  id,
  label,
  value,
  placeholder,
  onChange,
  maxLength,
  minHeightClassName = "min-h-24",
}: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  maxLength: number;
  minHeightClassName?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5" htmlFor={id}>
      <span className="font-semibold text-sm text-text-label">{label}</span>
      <textarea
        className={`${minHeightClassName} w-full resize-y rounded-xl border border-border-input bg-bg-light px-3.5 py-3 text-sm text-text-heading leading-5 placeholder:text-text-placeholder hover:border-border-control focus:border-primary-blue focus:outline-none`}
        id={id}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
    </label>
  );
}

function ExportSectionHeader({
  icon,
  title,
  description,
  badge,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  badge?: string;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-bg-input text-text-secondary">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold text-base text-text-heading">{title}</h3>
          {badge ? (
            <span className="rounded-full bg-bg-input px-2 py-0.5 font-semibold text-[11px] text-text-secondary uppercase tracking-wide">
              {badge}
            </span>
          ) : null}
        </div>
        {description ? (
          <p className="mt-0.5 text-sm text-text-secondary leading-5">
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function ResumeDownloadButton({
  candidateId,
  hasHhResume,
  hasAiAnalysis,
}: {
  candidateId: string;
  hasHhResume: boolean;
  hasAiAnalysis: boolean;
}) {
  const t = useTranslations("ResumeExport");
  const { data: companyFeatures } = api.company.getFeatures.useQuery();
  const resumeDesigns = companyFeatures?.resumeDesigns ?? [];
  const [isOpen, setIsOpen] = useState(false);
  const [format, setFormat] = useState<ExportFormat>("pdf");
  const [order, setOrder] = useState<SectionKey[]>([...DEFAULT_ORDER]);
  const [selected, setSelected] = useState<Set<SectionKey>>(
    new Set(DEFAULT_ORDER),
  );
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [coverLetter, setCoverLetter] = useState("");
  const [includeAiAnalysis, setIncludeAiAnalysis] = useState(false);
  const [assessment, setAssessment] =
    useState<AssessmentValues>(EMPTY_ASSESSMENT);
  const [downloading, setDownloading] = useState<DownloadKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hhUnavailableTooltipId = useId();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );
  const isBusy = downloading !== null;

  const toggleSection = (value: SectionKey) => {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      return next;
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setOrder((previous) =>
        arrayMove(
          previous,
          previous.indexOf(active.id as SectionKey),
          previous.indexOf(over.id as SectionKey),
        ),
      );
    }
  };

  const onLogoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (file && !["image/png", "image/jpeg"].includes(file.type)) {
      setError(t("invalidLogo"));
      return;
    }
    setError(null);
    setLogoFile(file);
  };

  const run = async (
    key: DownloadKey,
    url: string,
    fileName: string,
    init?: RequestInit,
  ) => {
    if (isBusy) {
      return;
    }
    setDownloading(key);
    setError(null);
    try {
      await downloadFromUrl(url, fileName, t("downloadError"), init);
    } catch (downloadError) {
      console.error(`Failed to download ${key} resume`, downloadError);
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : t("downloadError"),
      );
    } finally {
      setDownloading(null);
    }
  };

  const ext = format === "pdf" ? "pdf" : "docx";
  const orderedSelected = order.filter((value) => selected.has(value));

  const downloadPersonHunters = (designKey: string) => {
    const formData = new FormData();
    formData.append("template", designKey);
    formData.append("format", format);
    formData.append("coverLetter", coverLetter);
    formData.append(
      "includeAiAnalysis",
      String(includeAiAnalysis && hasAiAnalysis),
    );
    for (const field of ASSESSMENT_FIELDS) {
      formData.append(`assessment.${field}`, assessment[field]);
    }
    run(
      designKey,
      `/api/candidates/${candidateId}/profile-export`,
      `${designKey}-${candidateId}.${ext}`,
      { method: "POST", body: formData },
    );
  };

  return (
    <>
      <button
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className={`ui-button group active:scale-100 ${
          isOpen
            ? "border border-primary-blue/45 bg-primary-blue-light text-primary-blue shadow-[0_0_0_3px_rgba(253,55,44,0.10)]"
            : "ui-button-secondary"
        }`}
        onClick={() => setIsOpen(true)}
        type="button"
      >
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 font-semibold text-xs leading-none transition-colors ${
            isOpen
              ? "bg-primary-blue text-white"
              : "bg-primary-blue-light text-primary-blue"
          }`}
        >
          PDF
        </span>
        {t("title")}
        <DownloadIcon
          className={`h-4 w-4 transition-transform duration-200 ease-out ${
            isOpen
              ? "translate-y-0.5"
              : "group-hover:translate-y-0.5 group-focus-visible:translate-y-0.5"
          }`}
        />
      </button>

      <Modal
        description={t("modalDescription")}
        isOpen={isOpen}
        maxWidthClassName="max-w-[860px]"
        onClose={() => setIsOpen(false)}
        panelClassName="sm:p-7"
        title={t("title")}
      >
        <div className="flex flex-col gap-4">
          <section className="rounded-2xl border border-border-light bg-bg-input/45 p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <ExportSectionHeader
                badge="PDF"
                description={t("hhDescription")}
                icon={<FileOutlineIcon className="h-5 w-5" />}
                title="hh.uz"
              />
              <div
                aria-describedby={
                  hasHhResume ? undefined : hhUnavailableTooltipId
                }
                className="group/hh-tooltip relative w-full shrink-0 sm:w-auto"
                tabIndex={hasHhResume ? undefined : 0}
              >
                <button
                  className="ui-button ui-button-secondary w-full"
                  disabled={isBusy || !hasHhResume}
                  onClick={() =>
                    run(
                      "hh",
                      `/api/candidates/${candidateId}/resume`,
                      `resume-${candidateId}.pdf`,
                    )
                  }
                  type="button"
                >
                  <LoadingButtonContent
                    isLoading={downloading === "hh"}
                    label={t("downloadOriginal")}
                    loadingLabel={t("downloading")}
                  />
                </button>
                {!hasHhResume ? (
                  <span
                    className="pointer-events-none absolute right-0 bottom-full z-20 mb-2 w-max max-w-64 rounded-lg border border-border-control bg-text-heading px-3 py-2 text-left text-white text-xs leading-4 opacity-0 shadow-lg transition-opacity group-hover/hh-tooltip:opacity-100 group-focus/hh-tooltip:opacity-100"
                    id={hhUnavailableTooltipId}
                    role="tooltip"
                  >
                    {t("hhUnavailable")}
                  </span>
                ) : null}
              </div>
            </div>
          </section>

          {resumeDesigns.map((designKey) =>
            designKey === PERSON_HUNTERS_DESIGN ? (
              <section
                className="rounded-2xl border border-border-light bg-bg-light p-4 shadow-[0_1px_2px_rgba(24,34,52,0.03)] sm:p-5"
                key={designKey}
              >
                <div className="flex flex-col gap-4 border-border-light border-b pb-5 sm:flex-row sm:items-start sm:justify-between">
                  <ExportSectionHeader
                    icon={<FileOutlineIcon className="h-5 w-5" />}
                    title={DESIGN_LABELS[designKey] ?? designKey}
                  />
                  <FormatToggle
                    disabled={isBusy}
                    onChange={setFormat}
                    value={format}
                  />
                </div>

                <div className="mt-5 grid gap-5">
                  <FieldTextarea
                    id="resume-cover-letter"
                    label={t("coverLetter")}
                    maxLength={8000}
                    onChange={setCoverLetter}
                    placeholder={t("coverLetterPlaceholder")}
                    value={coverLetter}
                  />

                  <label
                    className={`flex items-start gap-3 rounded-xl border border-border-input p-3.5 ${
                      hasAiAnalysis
                        ? "cursor-pointer bg-bg-input/60 hover:border-border-control"
                        : "cursor-not-allowed bg-bg-input/35 opacity-65"
                    }`}
                  >
                    <input
                      checked={includeAiAnalysis && hasAiAnalysis}
                      className="sr-only"
                      disabled={!hasAiAnalysis || isBusy}
                      onChange={(event) =>
                        setIncludeAiAnalysis(event.target.checked)
                      }
                      type="checkbox"
                    />
                    <span
                      className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                        includeAiAnalysis && hasAiAnalysis
                          ? "border-primary-blue bg-primary-blue text-white"
                          : "border-border-control bg-bg-light text-transparent"
                      }`}
                    >
                      <CheckIcon className="h-3.5 w-3.5" />
                    </span>
                    <AIGenerationIcon className="mt-0.5 h-5 w-5 shrink-0 text-ai-violet" />
                    <span className="min-w-0">
                      <span className="block font-semibold text-sm text-text-heading">
                        {t("includeAiAnalysis")}
                      </span>
                      {!hasAiAnalysis ? (
                        <span className="mt-0.5 block text-text-secondary text-xs leading-5">
                          {t("aiUnavailable")}
                        </span>
                      ) : null}
                    </span>
                  </label>

                  <div>
                    <h4 className="mb-3 font-semibold text-sm text-text-heading">
                      {t("assessmentTitle")}
                    </h4>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {ASSESSMENT_FIELDS.map((field) => (
                        <FieldTextarea
                          id={`resume-assessment-${field}`}
                          key={field}
                          label={t(`assessmentFields.${field}`)}
                          maxLength={3000}
                          minHeightClassName="min-h-20"
                          onChange={(value) =>
                            setAssessment((previous) => ({
                              ...previous,
                              [field]: value,
                            }))
                          }
                          placeholder={t("assessmentPlaceholder")}
                          value={assessment[field]}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end border-border-light border-t pt-5">
                    <button
                      className="ui-button ui-button-primary w-full shrink-0 px-4 sm:w-auto"
                      disabled={isBusy}
                      onClick={() => downloadPersonHunters(designKey)}
                      type="button"
                    >
                      <DownloadIcon className="h-4 w-4" />
                      <LoadingButtonContent
                        isLoading={downloading === designKey}
                        label={t("downloadPrepared")}
                        loadingLabel={t("downloading")}
                      />
                    </button>
                  </div>
                </div>
              </section>
            ) : (
              <section
                className="rounded-2xl border border-border-light p-4 sm:p-5"
                key={designKey}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <ExportSectionHeader
                    description={t("brandedTemplate")}
                    icon={<FileOutlineIcon className="h-5 w-5" />}
                    title={DESIGN_LABELS[designKey] ?? designKey}
                  />
                  <div className="flex items-center gap-3">
                    <FormatToggle
                      disabled={isBusy}
                      onChange={setFormat}
                      value={format}
                    />
                    <button
                      className="ui-button ui-button-primary px-3"
                      disabled={isBusy}
                      onClick={() =>
                        run(
                          designKey,
                          `/api/candidates/${candidateId}/profile-export?template=${encodeURIComponent(designKey)}&format=${format}`,
                          `${designKey}-${candidateId}.${ext}`,
                        )
                      }
                      type="button"
                    >
                      <LoadingButtonContent
                        isLoading={downloading === designKey}
                        label={t("download")}
                        loadingLabel={t("downloading")}
                      />
                    </button>
                  </div>
                </div>
              </section>
            ),
          )}

          <details className="group rounded-2xl border border-border-light bg-bg-light">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4 sm:p-5 [&::-webkit-details-marker]:hidden">
              <ExportSectionHeader
                description={t("customDescription")}
                icon={<FileOutlineIcon className="h-5 w-5" />}
                title={t("customFormat")}
              />
              <ChevronDownIcon className="h-5 w-5 shrink-0 text-text-placeholder transition-transform group-open:rotate-180" />
            </summary>
            <div className="border-border-light border-t p-4 sm:p-5">
              <DndContext
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
                sensors={sensors}
              >
                <SortableContext
                  items={order}
                  strategy={verticalListSortingStrategy}
                >
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {order.map((value) => (
                      <SortableSectionRow
                        checked={selected.has(value)}
                        dragLabel={t("dragSection")}
                        id={value}
                        key={value}
                        label={t(`sections.${value}`)}
                        onToggle={() => toggleSection(value)}
                      />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-2">
                  <label className="ui-button ui-button-secondary cursor-pointer text-xs">
                    {t("uploadLogo")}
                    <input
                      accept="image/png,image/jpeg"
                      className="hidden"
                      onChange={onLogoChange}
                      type="file"
                    />
                  </label>
                  {logoFile ? (
                    <span className="flex min-w-0 items-center gap-2 text-text-secondary text-xs">
                      <span className="max-w-40 truncate">{logoFile.name}</span>
                      <button
                        className="shrink-0 text-text-placeholder hover:text-danger-red"
                        onClick={() => setLogoFile(null)}
                        type="button"
                      >
                        {t("remove")}
                      </button>
                    </span>
                  ) : null}
                </div>

                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <FormatToggle
                    disabled={isBusy}
                    onChange={setFormat}
                    value={format}
                  />
                  <button
                    className="ui-button ui-button-primary px-3"
                    disabled={isBusy || orderedSelected.length === 0}
                    onClick={() => {
                      const formData = new FormData();
                      formData.append("template", "custom");
                      formData.append("format", format);
                      formData.append("sections", orderedSelected.join(","));
                      if (logoFile) {
                        formData.append("logo", logoFile);
                      }
                      run(
                        "custom",
                        `/api/candidates/${candidateId}/profile-export`,
                        `resume-${candidateId}.${ext}`,
                        { method: "POST", body: formData },
                      );
                    }}
                    type="button"
                  >
                    <LoadingButtonContent
                      isLoading={downloading === "custom"}
                      label={t("download")}
                      loadingLabel={t("downloading")}
                    />
                  </button>
                </div>
              </div>
              {orderedSelected.length === 0 ? (
                <p className="mt-2 text-text-placeholder text-xs">
                  {t("selectSection")}
                </p>
              ) : null}
            </div>
          </details>

          <FeedbackPresence show={Boolean(error)}>
            <p className="rounded-xl bg-status-danger-soft px-3.5 py-3 text-danger-red text-sm leading-5">
              {error}
            </p>
          </FeedbackPresence>
        </div>
      </Modal>
    </>
  );
}
