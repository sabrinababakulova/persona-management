"use client";

import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import {
  ActionDropdown,
  type ActionDropdownItem,
} from "~/app/_components/action-dropdown";
import { Checkbox } from "~/app/_components/checkbox";
import {
  ChevronDownIcon,
  PencilIcon,
  SortIcon,
  TrashIcon,
} from "~/app/_components/icons";
import { api } from "~/trpc/react";

/** Dropdown entries shown when the user opens the "Создать публикацию" menu. */
const CHANNEL_OPTIONS: ActionDropdownItem[] = [
  { value: "linkedin", label: "Для LinkedIn", iconSrc: "/linkedin.svg" },
  { value: "hh.uz", label: "Для HH", iconSrc: "/hh.svg" },
  { value: "telegram", label: "Для Telegram", iconSrc: "/telegram.svg" },
];

/** Brand assets used to render the "Канал" column for each known platform. */
const CHANNEL_ICONS: Record<string, { src: string; label: string }> = {
  linkedin: { src: "/linkedin.svg", label: "LinkedIn" },
  "hh.uz": { src: "/hh.svg", label: "HH" },
  telegram: { src: "/telegram.svg", label: "Telegram" },
};

/** Inline duplicate-page glyph used for the row's "Дублировать" action. */
function CopyIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-label="Copy Icon"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.6}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect height="13" rx="2" width="13" x="8" y="8" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </svg>
  );
}

/** Formats a Date or ISO string to "DD.MM.YYYY" in the ru-RU locale; returns "" on invalid input. */
function formatDate(value?: Date | string | null): string {
  if (!value) {
    return "";
  }
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

/**
 * Renders the "Версии публикаций" list for a vacancy.
 *
 * The header row shows the section title plus a {@link trailingHeader} slot (used to inject the
 * "Создать публикацию" dropdown). Each publication renders its name, channel icon (derived from
 * the first entry in `sources`), an "Опубликовано / Неактивна" status badge, the creation date,
 * and row-level edit / copy / delete actions. The bottom "Действия" button is reserved for bulk
 * actions on rows the user has selected via the row checkboxes.
 */
export function PublicationsTable() {
  const router = useRouter();
  const { id: parentVacancyId } = useParams() as { id: string };

  const { data: publications } = api.vacancies.listPublications.useQuery(
    { parentVacancyId },
    { enabled: Boolean(parentVacancyId) },
  );

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const handleChannelSelect = (value: string) => {
    router.push(`/vacancies/${parentVacancyId}/publications/${value}`);
  };

  const toggle = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const onEdit = (id: string) => {
    router.push(`/vacancies/${parentVacancyId}/publications/hh.uz/${id}`);
  };
  const onCopy = (_id: string) => {};
  const onDelete = (_id: string) => {};

  return (
    <div className="flex flex-col gap-4">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="font-bold text-[28px] text-text-heading leading-none tracking-[-0.48px]">
          Версии публикаций
        </h2>
        <ActionDropdown
          items={CHANNEL_OPTIONS}
          onSelect={handleChannelSelect}
          triggerLabel="Создать публикацию"
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-border-input bg-bg-light">
        <div className="hidden grid-cols-12 border-border-input border-b bg-bg-input px-4 py-3 text-[14px] text-text-placeholder lg:grid">
          <div className="col-span-1" />
          <div className="col-span-4 flex items-center gap-1">
            <span>Название</span>
            <SortIcon className="h-4 w-4" />
          </div>
          <div className="col-span-2 flex items-center gap-1">
            <span>Канал</span>
            <SortIcon className="h-4 w-4" />
          </div>
          <div className="col-span-2 flex items-center gap-1">
            <span>Статус</span>
            <SortIcon className="h-4 w-4" />
          </div>
          <div className="col-span-2 flex items-center gap-1">
            <span>Дата создания</span>
            <SortIcon className="h-4 w-4" />
          </div>
          <div className="col-span-1" />
        </div>

        {publications?.map((pub) => {
          const platform = pub.destination;
          const icon = platform ? CHANNEL_ICONS[platform] : undefined;
          const dateLabel = formatDate(pub.createdAt);
          return (
            <div
              className="grid grid-cols-12 items-center gap-y-2 border-border-input border-b px-4 py-4 last:border-b-0"
              key={pub.id}
            >
              <div className="col-span-1">
                <Checkbox
                  checked={selectedIds.includes(pub.id)}
                  onChange={() => toggle(pub.id)}
                />
              </div>
              <div className="col-span-11 truncate font-medium text-[14px] text-text-heading lg:col-span-4">
                {pub.title}
              </div>
              <div className="col-span-1 lg:col-span-2">
                {icon && (
                  <Image
                    alt={icon.label}
                    className="h-7 w-7"
                    height={28}
                    src={icon.src}
                    title={icon.label}
                    unoptimized
                    width={28}
                  />
                )}
              </div>
              <div className="col-span-5 lg:col-span-2">
                <span className="inline-flex items-center gap-1 rounded-md bg-status-active-soft px-3 py-1 font-semibold text-[12px] text-status-active-strong uppercase leading-none">
                  {pub.isActive ? "Опубликовано" : "Неактивна"}
                  <ChevronDownIcon className="h-3 w-3" />
                </span>
              </div>
              <div className="col-span-3 text-[14px] text-text-heading lg:col-span-2">
                {dateLabel}
              </div>
              <div className="col-span-3 flex items-center justify-end gap-3 lg:col-span-1">
                <button
                  aria-label="Редактировать"
                  className="text-text-placeholder transition-colors hover:text-text-heading"
                  onClick={() => onEdit?.(pub.id)}
                  type="button"
                >
                  <PencilIcon className="h-4 w-4" />
                </button>
                <button
                  aria-label="Дублировать"
                  className="text-text-placeholder transition-colors hover:text-text-heading"
                  onClick={() => onCopy?.(pub.id)}
                  type="button"
                >
                  <CopyIcon className="h-4 w-4" />
                </button>
                <button
                  aria-label="Удалить"
                  className="text-accent-red transition-opacity hover:opacity-80"
                  onClick={() => onDelete?.(pub.id)}
                  type="button"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}

        <div className="flex justify-end border-border-input border-t px-4 py-3">
          <button
            className="inline-flex items-center gap-2 rounded-md border border-border-input px-3 py-2 text-[14px] text-text-secondary transition-colors hover:bg-bg-hover"
            type="button"
          >
            <span>Действия</span>
            <ChevronDownIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
