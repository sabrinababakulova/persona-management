"use client";

import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import {
  ActionDropdown,
  type ActionDropdownItem,
} from "~/app/_components/action-dropdown";
import { Checkbox } from "~/app/_components/checkbox";
import { Dropdown } from "~/app/_components/dropdown";
import {
  ChevronDownIcon,
  PencilIcon,
  SortIcon,
  TrashIcon,
} from "~/app/_components/icons";
import { Modal } from "~/app/_components/modal";
import { api } from "~/trpc/react";
import { PublicationConfirmationModal } from "./publications/[channel]/publication-confirmation-modal";

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

const ACTIVE_STATUS_OPTIONS = [
  { value: "active", label: "Активна" },
  { value: "inactive", label: "Неактивна" },
];

const VACANCY_STATUSES = new Set([
  "active",
  "archive",
  "draft",
  "paused",
  "closed",
]);

function normalizeVacancyStatus(
  status: string | null,
): "active" | "archive" | "draft" | "paused" | "closed" {
  return status && VACANCY_STATUSES.has(status)
    ? (status as "active" | "archive" | "draft" | "paused" | "closed")
    : "draft";
}

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
  const utils = api.useUtils();

  const { data: publications } = api.vacancies.listPublications.useQuery(
    { parentVacancyId },
    { enabled: Boolean(parentVacancyId) },
  );

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteCandidateId, setDeleteCandidateId] = useState<string | null>(
    null,
  );
  const [pendingStatusChange, setPendingStatusChange] = useState<{
    id: string;
    isActive: boolean;
    destination: string | undefined;
  } | null>(null);
  const duplicatePublication = api.vacancies.create.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.vacancies.list.invalidate(),
        utils.vacancies.listPublications.invalidate({ parentVacancyId }),
      ]);
    },
    onError: (error) => {
      console.error("Failed to duplicate vacancy publication", error);
    },
  });
  const deletePublication = api.vacancies.deletePublication.useMutation({
    onSuccess: async (_result, variables) => {
      setSelectedIds((current) => current.filter((id) => id !== variables.id));
      await Promise.all([
        utils.vacancies.list.invalidate(),
        utils.vacancies.listPublications.invalidate({ parentVacancyId }),
      ]);
    },
    onError: (error) => {
      console.error("Failed to delete vacancy publication", error);
    },
  });
  const updatePublicationStatus = api.vacancies.update.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.vacancies.listPublications.invalidate({ parentVacancyId }),
      ]);
    },
    onError: (error) => {
      console.error("Failed to update vacancy publication status", error);
    },
  });

  const handleChannelSelect = (value: string) => {
    router.push(`/vacancies/${parentVacancyId}/publications/${value}`);
  };

  const toggle = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const onEdit = (id: string, destination: string) => {
    router.push(
      `/vacancies/${parentVacancyId}/publications/${destination}/${id}`,
    );
  };
  const onCopy = (id: string) => {
    const publication = publications?.find((item) => item.id === id);
    if (!publication || duplicatePublication.isPending) {
      return;
    }

    duplicatePublication.mutate({
      parentId: publication.parentId,
      title: `${publication.title} (копия)`,
      status: normalizeVacancyStatus(publication.status),
      responses: publication.responses ?? 0,
      areaId: publication.areaId ?? undefined,
      employmentId: publication.employmentId ?? undefined,
      scheduleId: publication.scheduleId ?? undefined,
      experienceId: publication.experienceId ?? undefined,
      professionalRoleId: publication.professionalRoleId ?? undefined,
      billingTypeId: publication.billingTypeId ?? undefined,
      salaryFrom: publication.salaryFrom ?? undefined,
      salaryTo: publication.salaryTo ?? undefined,
      salaryCurrency: publication.salaryCurrency === "USD" ? "USD" : "UZS",
      descriptionHtml: publication.descriptionHtml ?? undefined,
      contactPhone: publication.contactPhone ?? undefined,
      isActive: publication.isActive,
      isPublication: true,
      destination: publication.destination ?? undefined,
    });
  };
  const onDelete = (id: string) => {
    setDeleteCandidateId(id);
  };

  const onStatusChange = (
    id: string,
    isActive: boolean,
    destination: string | undefined,
  ) => {
    const publication = publications?.find((item) => item.id === id);
    if (!publication || publication.isActive === isActive) {
      return;
    }

    setPendingStatusChange({ id, isActive, destination });
  };

  const confirmStatusChange = () => {
    if (!pendingStatusChange || updatePublicationStatus.isPending) {
      return;
    }

    updatePublicationStatus.mutate(pendingStatusChange, {
      onSettled: () => setPendingStatusChange(null),
    });
  };

  const confirmDelete = () => {
    if (!deleteCandidateId || deletePublication.isPending) {
      return;
    }

    deletePublication.mutate(
      { id: deleteCandidateId },
      {
        onSettled: () => setDeleteCandidateId(null),
      },
    );
  };

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
                <Dropdown
                  className="w-full max-w-35"
                  disabled={updatePublicationStatus.isPending}
                  fieldClassName={
                    pub.isActive
                      ? "max-h-[30px] border-status-active-bg bg-status-active-bg font-semibold text-status-active hover:border-status-active hover:bg-status-active-bg focus:border-status-active focus:bg-status-active-bg"
                      : "max-h-[30px] border-status-closed-bg bg-status-closed-bg font-semibold text-status-closed hover:border-status-closed hover:bg-status-closed-bg focus:border-status-closed focus:bg-status-closed-bg"
                  }
                  hideLabel
                  iconClassName={
                    pub.isActive ? "text-status-active" : "text-status-closed"
                  }
                  label="Статус публикации"
                  onChange={(value) =>
                    onStatusChange(
                      pub.id,
                      value === "active",
                      pub.destination ?? "",
                    )
                  }
                  options={ACTIVE_STATUS_OPTIONS}
                  value={pub.isActive ? "active" : "inactive"}
                />
              </div>
              <div className="col-span-3 text-[14px] text-text-heading lg:col-span-2">
                {dateLabel}
              </div>
              <div className="col-span-3 flex items-center justify-end gap-3 lg:col-span-1">
                <button
                  aria-label="Редактировать"
                  className="text-text-placeholder transition-colors hover:text-text-heading"
                  onClick={() => onEdit?.(pub.id, pub.destination ?? "")}
                  type="button"
                >
                  <PencilIcon className="h-4 w-4" />
                </button>
                <button
                  aria-label="Дублировать"
                  className="text-text-placeholder transition-colors hover:text-text-heading"
                  disabled={duplicatePublication.isPending}
                  onClick={() => onCopy?.(pub.id)}
                  type="button"
                >
                  <CopyIcon className="h-4 w-4" />
                </button>
                <button
                  aria-label="Удалить"
                  className="text-accent-red transition-opacity hover:opacity-80"
                  disabled={deletePublication.isPending}
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

      <Modal
        ariaLabel="Подтверждение удаления публикации"
        isOpen={Boolean(deleteCandidateId)}
        onClose={() => setDeleteCandidateId(null)}
        title="Удалить публикацию?"
      >
        <div className="flex flex-col gap-5">
          <p className="text-[14px] text-text-secondary leading-[1.4]">
            Are you sure you want to delete publication?
          </p>
          <div className="flex justify-end gap-3">
            <button
              className="rounded-md border border-border-input px-4 py-2 text-[14px] text-text-secondary transition-colors hover:bg-bg-hover"
              onClick={() => setDeleteCandidateId(null)}
              type="button"
            >
              Отмена
            </button>
            <button
              className="rounded-md bg-accent-red px-4 py-2 font-medium text-[14px] text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={deletePublication.isPending}
              onClick={confirmDelete}
              type="button"
            >
              {deletePublication.isPending ? "Удаление..." : "Удалить"}
            </button>
          </div>
        </div>
      </Modal>

      <PublicationConfirmationModal
        description={
          pendingStatusChange?.isActive &&
          pendingStatusChange.destination === "hh.uz"
            ? "Публикация будет опубликована на hh.uz"
            : "Публикация будет архивирована в hh.uz"
        }
        isOpen={Boolean(pendingStatusChange)}
        isPending={updatePublicationStatus.isPending}
        onClose={() => setPendingStatusChange(null)}
        onConfirm={confirmStatusChange}
        onReject={() => setPendingStatusChange(null)}
        title={
          pendingStatusChange?.isActive
            ? "Активировать публикацию?"
            : "Деактивировать публикацию?"
        }
      />
    </div>
  );
}
