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
import { useState } from "react";
import { DownloadIcon } from "~/app/_components/icons";
import { Modal } from "~/app/_components/modal";
import {
  FeedbackPresence,
  LoadingButtonContent,
} from "~/app/_components/motion-system";

type ExportFormat = "pdf" | "docx";
type DownloadKey = "hh" | "person-hunters" | "custom";

/** Section keys must match the server's PROFILE_SECTIONS; order here is the default. */
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
      // Non-JSON body (e.g. an HTML error page) — keep the status message.
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
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      className={`flex items-center gap-2 rounded-lg border border-border-input bg-bg-light px-2 py-2 ${
        isDragging ? "opacity-70 shadow-md" : ""
      }`}
      ref={setNodeRef}
      style={style}
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
      <label className="flex flex-1 cursor-pointer items-center gap-2 text-text-heading text-xs">
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
    <div className="inline-flex overflow-hidden rounded-lg border border-border-input">
      {(["pdf", "docx"] as const).map((format) => (
        <button
          className={`px-3 py-1.5 font-medium text-xs transition-colors ${
            value === format
              ? "bg-primary-blue text-bg-light"
              : "bg-bg-input text-text-secondary hover:text-text-heading"
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

/**
 * Single "Скачать резюме" button that opens a modal offering three resume
 * exports: the original hh.uz file, the branded Person Hunters template, and a
 * configurable custom export where the user reorders (drag-and-drop) and picks
 * sections plus format. The exported file follows the chosen section order.
 */
export function ResumeDownloadButton({
  candidateId,
  hasHhResume,
}: {
  candidateId: string;
  hasHhResume: boolean;
}) {
  const t = useTranslations("ResumeExport");
  const [isOpen, setIsOpen] = useState(false);
  const [format, setFormat] = useState<ExportFormat>("pdf");
  const [order, setOrder] = useState<SectionKey[]>([...DEFAULT_ORDER]);
  const [selected, setSelected] = useState<Set<SectionKey>>(
    new Set(DEFAULT_ORDER),
  );
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [downloading, setDownloading] = useState<DownloadKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const isBusy = downloading !== null;

  const toggleSection = (value: SectionKey) => {
    setSelected((prev) => {
      const next = new Set(prev);
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
      setOrder((prev) =>
        arrayMove(
          prev,
          prev.indexOf(active.id as SectionKey),
          prev.indexOf(over.id as SectionKey),
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
  // Preserve drag order, keep only checked sections.
  const orderedSelected = order.filter((value) => selected.has(value));

  return (
    <>
      <button
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className={`ui-button group active:scale-100 ${
          isOpen
            ? "border border-primary-blue/45 bg-primary-blue-light text-primary-blue shadow-[0_0_0_3px_rgba(35,122,248,0.10)]"
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
        isOpen={isOpen}
        maxWidthClassName="max-w-[520px]"
        onClose={() => setIsOpen(false)}
        title={t("title")}
      >
        <div className="flex flex-col gap-4">
          {/* hh.uz — original file, always PDF */}
          <section className="rounded-xl border border-border-input p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-sm text-text-heading">hh.uz</p>
                <p className="text-text-secondary text-xs">
                  {t("hhDescription")}
                </p>
              </div>
              <button
                className="ui-button ui-button-primary min-h-9 px-3"
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
                  label={t("download")}
                  loadingLabel={t("downloading")}
                />
              </button>
            </div>
            {!hasHhResume && (
              <p className="mt-2 text-text-placeholder text-xs">
                {t("hhUnavailable")}
              </p>
            )}
          </section>

          {/* Person Hunters — branded template */}
          <section className="rounded-xl border border-border-input p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-sm text-text-heading">
                  Person Hunters
                </p>
                <p className="text-text-secondary text-xs">
                  {t("brandedTemplate")}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <FormatToggle
                  disabled={isBusy}
                  onChange={setFormat}
                  value={format}
                />
                <button
                  className="ui-button ui-button-primary min-h-9 px-3"
                  disabled={isBusy}
                  onClick={() =>
                    run(
                      "person-hunters",
                      `/api/candidates/${candidateId}/profile-export?format=${format}`,
                      `person-hunters-${candidateId}.${ext}`,
                    )
                  }
                  type="button"
                >
                  <LoadingButtonContent
                    isLoading={downloading === "person-hunters"}
                    label={t("download")}
                    loadingLabel={t("downloading")}
                  />
                </button>
              </div>
            </div>
          </section>

          {/* Custom — drag to reorder, check to include, pick format */}
          <section className="rounded-xl border border-border-input p-4">
            <p className="font-semibold text-sm text-text-heading">
              {t("customFormat")}
            </p>
            <p className="text-text-secondary text-xs">
              {t("customDescription")}
            </p>
            <DndContext
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
              sensors={sensors}
            >
              <SortableContext
                items={order}
                strategy={verticalListSortingStrategy}
              >
                <ul className="mt-3 flex flex-col gap-2">
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

            {/* Optional logo placed at the top of the custom resume */}
            <div className="mt-3 flex items-center gap-2">
              <label className="cursor-pointer rounded-lg border border-border-input bg-bg-input px-3 py-1.5 font-medium text-text-secondary text-xs transition-colors hover:text-text-heading">
                {t("uploadLogo")}
                <input
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={onLogoChange}
                  type="file"
                />
              </label>
              {logoFile && (
                <span className="flex items-center gap-2 text-text-secondary text-xs">
                  <span className="max-w-[160px] truncate">
                    {logoFile.name}
                  </span>
                  <button
                    className="text-text-placeholder hover:text-danger-red"
                    onClick={() => setLogoFile(null)}
                    type="button"
                  >
                    {t("remove")}
                  </button>
                </span>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <FormatToggle
                disabled={isBusy}
                onChange={setFormat}
                value={format}
              />
              <button
                className="ui-button ui-button-primary min-h-9 px-3"
                disabled={isBusy || orderedSelected.length === 0}
                onClick={() => {
                  const formData = new FormData();
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
            {orderedSelected.length === 0 && (
              <p className="mt-2 text-text-placeholder text-xs">
                {t("selectSection")}
              </p>
            )}
          </section>

          <FeedbackPresence show={Boolean(error)}>
            <p className="text-danger-red text-xs leading-[1.4]">{error}</p>
          </FeedbackPresence>
        </div>
      </Modal>
    </>
  );
}
