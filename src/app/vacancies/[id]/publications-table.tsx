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
import {
  FeedbackPresence,
  LoadingButtonContent,
  LoadingState,
} from "~/app/_components/motion-system";
import { api } from "~/trpc/react";
import { PublicationConfirmationModal } from "./publications/[channel]/publication-confirmation-modal";

/** Dropdown entries shown when the user opens the "Создать публикацию" menu. */
const CHANNEL_OPTIONS: ActionDropdownItem[] = [
  { value: "linkedin", label: "Для LinkedIn", iconSrc: "/linkedin.svg" },
  { value: "hh.uz", label: "Для HH", iconSrc: "/hh.svg" },
  { value: "telegram", label: "Для Telegram", iconSrc: "/telegram.svg" },
  {
    value: "person-hunter",
    label: "Для PersonHunters",
    iconSrc: "/person-hunter.svg",
  },
  { value: "olx.uz", label: "Для OLX.uz", iconSrc: "/olx.svg" },
];

/** Brand assets used to render the "Канал" column for each known platform. */
const CHANNEL_ICONS: Record<string, { src: string; label: string }> = {
  linkedin: { src: "/linkedin.svg", label: "LinkedIn" },
  "hh.uz": { src: "/hh.svg", label: "HH" },
  telegram: { src: "/telegram.svg", label: "Telegram" },
  "person-hunter": { src: "/person-hunter.svg", label: "PersonHunters" },
  "olx.uz": { src: "/olx.svg", label: "OLX.uz" },
};

const ACTIVE_STATUS_OPTIONS = [
  { value: "active", label: "Активна" },
  { value: "inactive", label: "Неактивна" },
];

type PublicationState =
  | "published"
  | "pending"
  | "attention"
  | "inactive"
  | "draft"
  | "local";

const PUBLICATION_STATE_LABEL: Record<PublicationState, string> = {
  published: "Опубликовано",
  pending: "На модерации",
  attention: "Требует оплаты",
  inactive: "Снято с публикации",
  draft: "Черновик",
  local: "Локально",
};

const PUBLICATION_STATE_CLASS: Record<PublicationState, string> = {
  published: "bg-status-active-bg text-status-active",
  pending: "bg-status-paused-bg text-status-paused",
  attention: "bg-status-paused-bg text-status-paused",
  inactive: "bg-status-closed-bg text-status-closed",
  draft: "bg-status-closed-bg text-status-closed",
  local: "bg-bg-input text-text-placeholder",
};

function getPublicationState(publication: {
  hhVacancyId?: string | null;
  hhDraftId?: string | null;
  personHunterVacancyId?: string | null;
  olxAdvertId?: string | null;
  olxAdvertStatus?: string | null;
}): PublicationState {
  if (publication.olxAdvertId) {
    if (
      publication.olxAdvertStatus === "new" ||
      publication.olxAdvertStatus === "moderated" ||
      publication.olxAdvertStatus === "unconfirmed"
    ) {
      return "pending";
    }
    if (
      publication.olxAdvertStatus === "limited" ||
      publication.olxAdvertStatus === "unpaid"
    ) {
      return "attention";
    }
    if (
      publication.olxAdvertStatus &&
      publication.olxAdvertStatus !== "active"
    ) {
      return "inactive";
    }
    return "published";
  }
  if (publication.hhVacancyId || publication.personHunterVacancyId) {
    return "published";
  }
  if (publication.hhDraftId) {
    return "draft";
  }
  return "local";
}

/**
 * Returns the external URL where the published vacancy can be viewed, or `null` for publications
 * that have no public destination yet (drafts, local-only).
 */
function getPublicationExternalUrl(publication: {
  destination?: string | null;
  hhVacancyId?: string | null;
  personHunterUniqueCode?: string | null;
  telegramPostId?: string | null;
  olxAdvertUrl?: string | null;
}): string | null {
  if (publication.destination === "hh.uz" && publication.hhVacancyId) {
    return `https://hh.uz/vacancy/${publication.hhVacancyId}`;
  }
  // PersonHunters keys its public vacancy page on the `unique_code` slug, not the numeric id —
  // e.g. https://personhunters.com/ru/vacancy/menedzer-po-razvitiu
  if (
    publication.destination === "person-hunter" &&
    publication.personHunterUniqueCode
  ) {
    return `https://personhunters.com/ru/vacancy/${publication.personHunterUniqueCode}`;
  }
  if (publication.destination === "telegram" && publication.telegramPostId) {
    return publication.telegramPostId;
  }
  if (publication.destination === "olx.uz" && publication.olxAdvertUrl) {
    return publication.olxAdvertUrl;
  }
  return null;
}

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

  const {
    data: publications,
    error: publicationsError,
    isError: isPublicationsError,
    isLoading: isPublicationsLoading,
  } = api.vacancies.listPublications.useQuery(
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
  const [isDeactivationBlocked, setIsDeactivationBlocked] = useState(false);
  const [isTelegramDeleteSuccess, setIsTelegramDeleteSuccess] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const duplicatePublication = api.vacancies.create.useMutation({
    onSuccess: async () => {
      setActionError(null);
      await Promise.all([
        utils.vacancies.list.invalidate(),
        utils.vacancies.listPublications.invalidate({ parentVacancyId }),
      ]);
    },
    onError: (error) => {
      setActionError(
        error.message || "Не удалось дублировать публикацию. Попробуйте снова.",
      );
    },
  });
  const deletePublication = api.vacancies.deletePublication.useMutation({
    onSuccess: async (_result, variables) => {
      setActionError(null);
      setSelectedIds((current) => current.filter((id) => id !== variables.id));
      await Promise.all([
        utils.vacancies.list.invalidate(),
        utils.vacancies.listPublications.invalidate({ parentVacancyId }),
      ]);
    },
    onError: (error) => {
      setActionError(
        error.message || "Не удалось удалить публикацию. Попробуйте снова.",
      );
    },
  });
  const updatePublicationStatus = api.vacancies.update.useMutation({
    onSuccess: async () => {
      setActionError(null);
      await Promise.all([
        utils.vacancies.listPublications.invalidate({ parentVacancyId }),
      ]);
    },
    onError: (error) => {
      if (error.data?.code === "FORBIDDEN") {
        setIsDeactivationBlocked(true);
        return;
      }
      setActionError(
        error.message ||
          "Не удалось изменить статус публикации. Попробуйте снова.",
      );
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
      vacancyTypeId: publication.vacancyTypeId ?? undefined,
      billingTypeId: publication.billingTypeId ?? undefined,
      salaryFrom: publication.salaryFrom ?? undefined,
      salaryTo: publication.salaryTo ?? undefined,
      salaryCurrency: publication.salaryCurrency === "USD" ? "USD" : "UZS",
      descriptionHtml: publication.descriptionHtml ?? undefined,
      contactPhone: publication.contactPhone ?? undefined,
      isActive: false,
      isPublication: true,
      destination: publication.destination ?? undefined,
      olxMeta: publication.olxMeta ?? undefined,
    });
  };
  const onDelete = (id: string) => {
    const publication = publications?.find((item) => item.id === id);
    if (!publication || publication.isActive) {
      return;
    }

    setActionError(null);
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
    setActionError(null);

    // hh.uz / PersonHunters changes and Telegram deactivations need a confirmation step (the
    // latter deletes the channel post); other status changes apply directly.

    if (
      destination === "hh.uz" ||
      destination === "person-hunter" ||
      destination === "olx.uz" ||
      (destination === "telegram" && !isActive)
    ) {
      setPendingStatusChange({ id, isActive, destination });
      return;
    }

    if (updatePublicationStatus.isPending) {
      return;
    }
    updatePublicationStatus.mutate({ id, isActive });
  };

  const confirmStatusChange = () => {
    if (!pendingStatusChange || updatePublicationStatus.isPending) {
      return;
    }

    // Deactivating a Telegram publication removes its channel post — confirm that on success.
    const isTelegramDeactivation =
      pendingStatusChange.destination === "telegram" &&
      !pendingStatusChange.isActive;

    updatePublicationStatus.mutate(pendingStatusChange, {
      onSuccess: isTelegramDeactivation
        ? () => setIsTelegramDeleteSuccess(true)
        : undefined,
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
        <h2 className="page-title">Версии публикаций</h2>
        <ActionDropdown
          items={CHANNEL_OPTIONS}
          onSelect={handleChannelSelect}
          triggerLabel="Создать публикацию"
        />
      </div>

      <FeedbackPresence show={Boolean(actionError || isPublicationsError)}>
        <div
          aria-live="polite"
          className="rounded-lg border border-danger-red bg-status-closed-bg px-4 py-3 text-danger-red text-sm leading-5"
          role="alert"
        >
          {actionError ??
            publicationsError?.message ??
            "Не удалось загрузить публикации."}
        </div>
      </FeedbackPresence>

      <div className="surface-card overflow-hidden">
        <div className="hidden grid-cols-12 border-border-input border-b bg-bg-input px-4 py-3 text-sm text-text-placeholder lg:grid">
          <div className="col-span-1" />
          <div className="col-span-3 flex items-center gap-1">
            <span>Название</span>
            <SortIcon className="h-4 w-4" />
          </div>
          <div className="col-span-1 flex items-center gap-1">
            <span>Канал</span>
            <SortIcon className="h-4 w-4" />
          </div>
          <div className="col-span-2 flex items-center gap-1">
            <span>Состояние</span>
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

        {isPublicationsLoading ? (
          <LoadingState
            className="min-h-40 text-text-placeholder"
            label="Загружаем публикации..."
          />
        ) : null}

        {!isPublicationsLoading &&
        !isPublicationsError &&
        publications?.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-text-secondary">
            Публикаций пока нет. Выберите канал и создайте первую версию.
          </div>
        ) : null}

        {publications?.map((pub) => {
          const platform = pub.destination;
          const icon = platform ? CHANNEL_ICONS[platform] : undefined;
          const dateLabel = formatDate(pub.createdAt);
          const state = getPublicationState(pub);
          const externalUrl = getPublicationExternalUrl(pub);
          const isOlxPendingModeration =
            pub.destination === "olx.uz" &&
            (pub.olxAdvertStatus === "new" ||
              pub.olxAdvertStatus === "moderated" ||
              pub.olxAdvertStatus === "unconfirmed");
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
              <div className="col-span-11 truncate font-medium text-sm text-text-heading lg:col-span-3">
                {externalUrl ? (
                  <a
                    className="hover:text-primary-blue hover:underline"
                    href={externalUrl}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {pub.title}
                  </a>
                ) : (
                  pub.title
                )}
              </div>
              <div className="col-span-1 lg:col-span-1">
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
              <div className="col-span-3 lg:col-span-2">
                <span
                  className={`inline-flex items-center rounded-md px-2 py-1 font-semibold text-xs leading-none ${PUBLICATION_STATE_CLASS[state]}`}
                >
                  {PUBLICATION_STATE_LABEL[state]}
                </span>
              </div>
              <div className="col-span-2 lg:col-span-2">
                <Dropdown
                  className="w-full max-w-35"
                  disabled={
                    updatePublicationStatus.isPending || isOlxPendingModeration
                  }
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
              <div className="col-span-3 text-sm text-text-heading lg:col-span-2">
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
                  className="text-accent-red transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:opacity-40"
                  disabled={pub.isActive || deletePublication.isPending}
                  onClick={() => onDelete?.(pub.id)}
                  type="button"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}

        {(publications?.length ?? 0) > 0 ? (
          <div className="flex justify-end border-border-input border-t px-4 py-3">
            <button
              className="ui-button ui-button-secondary min-h-9 px-3"
              type="button"
            >
              <span>Действия</span>
              <ChevronDownIcon className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </div>

      <Modal
        ariaLabel="Подтверждение удаления публикации"
        isOpen={Boolean(deleteCandidateId)}
        onClose={() => setDeleteCandidateId(null)}
        title="Удалить публикацию?"
      >
        <div className="flex flex-col gap-5">
          <p className="text-sm text-text-secondary leading-[1.4]">
            Are you sure you want to delete publication?
          </p>
          <div className="flex justify-end gap-3">
            <button
              className="ui-button ui-button-secondary"
              onClick={() => setDeleteCandidateId(null)}
              type="button"
            >
              Отмена
            </button>
            <button
              className="ui-button bg-accent-red text-white hover:opacity-90"
              disabled={deletePublication.isPending}
              onClick={confirmDelete}
              type="button"
            >
              <LoadingButtonContent
                isLoading={deletePublication.isPending}
                label="Удалить"
                loadingLabel="Удаление..."
              />
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        ariaLabel="Публикация удалена из Telegram"
        isOpen={isTelegramDeleteSuccess}
        onClose={() => setIsTelegramDeleteSuccess(false)}
        title="Успешно удалено"
      >
        <div className="flex flex-col gap-5">
          <p className="text-sm text-text-secondary leading-[1.4]">
            Публикация удалена из Telegram-канала.
          </p>
          <div className="flex justify-end">
            <button
              className="ui-button ui-button-secondary"
              onClick={() => setIsTelegramDeleteSuccess(false)}
              type="button"
            >
              Понятно
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        ariaLabel="Публикация не может быть деактивирована"
        isOpen={isDeactivationBlocked}
        onClose={() => setIsDeactivationBlocked(false)}
        title="Публикация не может быть деактивирована"
      >
        <div className="flex flex-col gap-5">
          <p className="text-sm text-text-secondary leading-[1.4]">
            Вы не можете деактивировать эту публикацию, так как её нельзя
            удалить в Telegram.
          </p>
          <div className="flex justify-end">
            <button
              className="ui-button ui-button-secondary"
              onClick={() => setIsDeactivationBlocked(false)}
              type="button"
            >
              Понятно
            </button>
          </div>
        </div>
      </Modal>

      <PublicationConfirmationModal
        description={
          pendingStatusChange?.destination === "telegram"
            ? "Публикация будет удалена из Telegram-канала."
            : pendingStatusChange?.destination === "person-hunter"
              ? pendingStatusChange?.isActive
                ? "Публикация будет опубликована на PersonHunters."
                : "Публикация будет скрыта на PersonHunters."
              : pendingStatusChange?.destination === "olx.uz"
                ? pendingStatusChange?.isActive
                  ? "Объявление будет активировано на OLX.uz."
                  : "Объявление будет снято с публикации на OLX.uz."
                : pendingStatusChange?.isActive
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
