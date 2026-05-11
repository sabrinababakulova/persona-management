"use client";

import Image from "next/image";
import { type ReactNode, useState } from "react";
import { Checkbox } from "~/app/_components/checkbox";
import {
  ChevronDownIcon,
  PencilIcon,
  SortIcon,
  TrashIcon,
} from "~/app/_components/icons";
import type { RouterOutputs } from "~/trpc/react";

type Publication = RouterOutputs["vacancies"]["listPublications"][number];

const CHANNEL_ICONS: Record<string, { src: string; label: string }> = {
  linkedin: { src: "/linkedin.svg", label: "LinkedIn" },
  "hh.uz": { src: "/hh.svg", label: "HH" },
  telegram: { src: "/telegram.svg", label: "Telegram" },
};

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

export function PublicationsTable({
  publications,
  trailingHeader,
  onEdit,
  onDelete,
  onCopy,
}: {
  publications: Publication[];
  trailingHeader?: ReactNode;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onCopy?: (id: string) => void;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggle = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-bold text-[28px] text-text-heading leading-none tracking-[-0.48px]">
          Версии публикаций
        </h2>
        {trailingHeader}
      </div>

      <div className="overflow-hidden rounded-[8px] border border-border-input bg-bg-light">
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

        {publications.map((pub) => {
          const platform = pub.sources?.[0]?.platform;
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
                {pub.name}
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
                <span className="inline-flex items-center gap-1 rounded-[6px] bg-status-active-soft px-3 py-1 font-semibold text-[12px] text-status-active-strong uppercase leading-none">
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
            className="inline-flex items-center gap-2 rounded-[6px] border border-border-input px-3 py-2 text-[14px] text-text-secondary transition-colors hover:bg-bg-hover"
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
