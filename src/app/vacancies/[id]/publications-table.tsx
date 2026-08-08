"use client";

import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useFormatter, useLocale, useTranslations } from "next-intl";
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
import { LoadingButtonContent } from "~/app/_components/motion-system";
import { useErrorToast } from "~/app/_components/use-error-toast";
import { api } from "~/trpc/react";
import { PublicationConfirmationModal } from "./publications/[channel]/publication-confirmation-modal";

/** Brand assets used to render the "Канал" column for each known platform. */
const CHANNEL_ICONS: Record<string, { src: string; label: string }> = {
  linkedin: { src: "/linkedin.svg", label: "LinkedIn" },
  "hh.uz": { src: "/hh.svg", label: "HH" },
  telegram: { src: "/telegram.svg", label: "Telegram" },
  "person-hunter": { src: "/person-hunter.svg", label: "PersonHunters" },
  "olx.uz": { src: "/olx.svg", label: "OLX.uz" },
  "rabota.ru": { src: "/rabota.svg", label: "rabota.ru" },
};

type PublicationState = "published" | "draft" | "local";

const PUBLICATION_STATE_CLASS: Record<PublicationState, string> = {
  published: "bg-badge-soft-green-bg text-text-heading",
  draft: "bg-status-closed-bg text-status-closed",
  local: "bg-bg-input text-text-placeholder",
};

function getPublicationState(publication: {
  hhVacancyId?: string | null;
  hhDraftId?: string | null;
  personHunterVacancyId?: string | null;
}): PublicationState {
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
function getPublicationExternalUrl(
  publication: {
    destination?: string | null;
    hhVacancyId?: string | null;
    personHunterUniqueCode?: string | null;
    telegramPostId?: string | null;
  },
  locale: string,
): string | null {
  if (publication.destination === "hh.uz" && publication.hhVacancyId) {
    return `https://hh.uz/vacancy/${publication.hhVacancyId}`;
  }
  // PersonHunters keys its public vacancy page on the `unique_code` slug, not the numeric id —
  // e.g. https://personhunters.com/ru/vacancy/menedzer-po-razvitiu
  if (
    publication.destination === "person-hunter" &&
    publication.personHunterUniqueCode
  ) {
    return `https://personhunters.com/${locale}/vacancy/${publication.personHunterUniqueCode}`;
  }
  if (publication.destination === "telegram" && publication.telegramPostId) {
    return publication.telegramPostId;
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
      aria-hidden="true"
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
  const format = useFormatter();
  const locale = useLocale();
  const t = useTranslations("Publications");
  const commonT = useTranslations("Common");
  const router = useRouter();
  const { id: parentVacancyId } = useParams() as { id: string };
  const utils = api.useUtils();
  const showError = useErrorToast();
  const { data: companyFeatures } = api.company.getFeatures.useQuery();
  const channelOptions: ActionDropdownItem[] = [
    { value: "hh.uz", label: t("table.forHh"), iconSrc: "/hh.svg" },
    {
      value: "telegram",
      label: t("table.forTelegram"),
      iconSrc: "/telegram.svg",
    },
    { value: "olx.uz", label: t("table.forOlx"), iconSrc: "/olx.svg" },
    {
      value: "rabota.ru",
      label: t("table.forRabota"),
      iconSrc: "/rabota.svg",
    },
    {
      value: "person-hunter",
      label: t("table.forPersonHunters"),
      iconSrc: "/person-hunter.svg",
    },
    // The PersonHunters channel is feature-flagged per company.
  ].filter(
    (option) =>
      option.value !== "person-hunter" ||
      (companyFeatures?.canPublishPersonHunter ?? false),
  );
  const activeStatusOptions = [
    { value: "active", label: t("table.active") },
    { value: "inactive", label: t("table.inactive") },
  ];
  const publicationStateLabels: Record<PublicationState, string> = {
    published: t("table.published"),
    draft: t("table.draft"),
    local: t("table.local"),
  };

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
  const [isDeactivationBlocked, setIsDeactivationBlocked] = useState(false);
  const [isTelegramDeleteSuccess, setIsTelegramDeleteSuccess] = useState(false);
  const duplicatePublication = api.vacancies.create.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.vacancies.list.invalidate(),
        utils.vacancies.listPublications.invalidate({ parentVacancyId }),
      ]);
    },
    onError: (error) => {
      console.error("Failed to duplicate vacancy publication", error);
      showError(error, { dedupeKey: "duplicate-publication" });
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
      showError(error, { dedupeKey: "delete-publication" });
    },
  });
  const updatePublicationStatus = api.vacancies.update.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.vacancies.listPublications.invalidate({ parentVacancyId }),
      ]);
    },
    onError: (error) => {
      if (error.data?.code === "FORBIDDEN") {
        setIsDeactivationBlocked(true);
        return;
      }
      console.error("Failed to update vacancy publication status", error);
      showError(error, { dedupeKey: "update-publication-status" });
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
      title: `${publication.title} (${t("table.copySuffix")})`,
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
    });
  };
  const onDelete = (id: string) => {
    const publication = publications?.find((item) => item.id === id);
    if (!publication || publication.isActive) {
      return;
    }

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

    // hh.uz / PersonHunters changes and Telegram deactivations need a confirmation step (the
    // latter deletes the channel post); other status changes apply directly.

    if (
      destination === "hh.uz" ||
      destination === "person-hunter" ||
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
        <h2 className="page-title">{t("table.versions")}</h2>
        <ActionDropdown
          items={channelOptions}
          onSelect={handleChannelSelect}
          triggerLabel={t("table.create")}
        />
      </div>

      <div className="surface-card overflow-hidden">
        <div className="hidden grid-cols-12 gap-x-4 border-border-input border-b bg-table-header-bg px-4 py-3 text-sm text-text-placeholder lg:grid">
          <div className="col-span-1" />
          <div className="col-span-3 flex items-center gap-1">
            <span>{t("table.name")}</span>
            <SortIcon className="h-4 w-4" />
          </div>
          <div className="col-span-1 flex items-center gap-1">
            <span>{t("table.channel")}</span>
            <SortIcon className="h-4 w-4" />
          </div>
          <div className="col-span-2 flex items-center gap-1">
            <span>{t("table.state")}</span>
            <SortIcon className="h-4 w-4" />
          </div>
          <div className="col-span-2 flex items-center gap-1">
            <span>{t("table.status")}</span>
            <SortIcon className="h-4 w-4" />
          </div>
          <div className="col-span-2 flex items-center gap-1">
            <span>{t("table.createdAt")}</span>
            <SortIcon className="h-4 w-4" />
          </div>
          <div className="col-span-1" />
        </div>

        {publications?.map((pub) => {
          const platform = pub.destination;
          const icon = platform ? CHANNEL_ICONS[platform] : undefined;
          const createdAt =
            typeof pub.createdAt === "string"
              ? new Date(pub.createdAt)
              : pub.createdAt;
          const dateLabel =
            createdAt && !Number.isNaN(createdAt.getTime())
              ? format.dateTime(createdAt, {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })
              : "";
          const state = getPublicationState(pub);
          const externalUrl = getPublicationExternalUrl(pub, locale);
          return (
            <div
              className="grid grid-cols-12 items-center gap-x-4 gap-y-2 border-border-input border-b px-4 py-4 last:border-b-0"
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
                  {publicationStateLabels[state]}
                </span>
              </div>
              <div className="col-span-2 lg:col-span-2">
                <Dropdown
                  className="w-fit"
                  disabled={updatePublicationStatus.isPending}
                  fieldClassName={
                    pub.isActive
                      ? "max-h-[30px] w-auto! px-2.5! pr-8! border-badge-soft-green-bg! bg-badge-soft-green-bg! font-semibold text-text-heading hover:border-border-control! hover:bg-badge-soft-green-bg! focus:border-border-control! focus:bg-badge-soft-green-bg!"
                      : "max-h-[30px] w-auto! px-2.5! pr-8! border-status-closed-bg bg-status-closed-bg font-semibold text-status-closed hover:border-status-closed hover:bg-status-closed-bg focus:border-status-closed focus:bg-status-closed-bg"
                  }
                  hideLabel
                  iconClassName={
                    pub.isActive ? "text-text-heading" : "text-status-closed"
                  }
                  label={t("table.publicationStatus")}
                  onChange={(value) =>
                    onStatusChange(
                      pub.id,
                      value === "active",
                      pub.destination ?? "",
                    )
                  }
                  options={activeStatusOptions}
                  value={pub.isActive ? "active" : "inactive"}
                />
              </div>
              <div className="col-span-3 text-sm text-text-heading lg:col-span-2">
                {dateLabel}
              </div>
              <div className="col-span-3 flex items-center justify-end gap-3 lg:col-span-1">
                <button
                  aria-label={t("table.edit")}
                  className="text-text-placeholder transition-colors hover:text-text-heading"
                  onClick={() => onEdit?.(pub.id, pub.destination ?? "")}
                  type="button"
                >
                  <PencilIcon className="h-4 w-4" />
                </button>
                <button
                  aria-label={t("table.duplicate")}
                  className="text-text-placeholder transition-colors hover:text-text-heading"
                  disabled={duplicatePublication.isPending}
                  onClick={() => onCopy?.(pub.id)}
                  type="button"
                >
                  <CopyIcon className="h-4 w-4" />
                </button>
                <button
                  aria-label={t("table.delete")}
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

        <div className="flex justify-end border-border-input border-t px-4 py-3">
          <button className="ui-button ui-button-secondary px-3" type="button">
            <span>{t("table.actions")}</span>
            <ChevronDownIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      <Modal
        ariaLabel={t("table.deleteConfirm")}
        isOpen={Boolean(deleteCandidateId)}
        onClose={() => setDeleteCandidateId(null)}
        title={t("table.deleteConfirm")}
      >
        <div className="flex flex-col gap-5">
          <p className="text-sm text-text-secondary leading-[1.4]">
            {t("table.deleteDescription")}
          </p>
          <div className="flex justify-end gap-3">
            <button
              className="ui-button ui-button-secondary"
              onClick={() => setDeleteCandidateId(null)}
              type="button"
            >
              {commonT("cancel")}
            </button>
            <button
              className="ui-button bg-accent-red text-white hover:opacity-90"
              disabled={deletePublication.isPending}
              onClick={confirmDelete}
              type="button"
            >
              <LoadingButtonContent
                isLoading={deletePublication.isPending}
                label={commonT("delete")}
                loadingLabel={t("table.deleting")}
              />
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        ariaLabel={t("table.telegramDeleted")}
        isOpen={isTelegramDeleteSuccess}
        onClose={() => setIsTelegramDeleteSuccess(false)}
        title={t("table.deletedTitle")}
      >
        <div className="flex flex-col gap-5">
          <p className="text-sm text-text-secondary leading-[1.4]">
            {t("table.deletedDescription")}
          </p>
          <div className="flex justify-end">
            <button
              className="ui-button ui-button-secondary"
              onClick={() => setIsTelegramDeleteSuccess(false)}
              type="button"
            >
              {t("table.understood")}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        ariaLabel={t("table.deactivationBlocked")}
        isOpen={isDeactivationBlocked}
        onClose={() => setIsDeactivationBlocked(false)}
        title={t("table.deactivationBlocked")}
      >
        <div className="flex flex-col gap-5">
          <p className="text-sm text-text-secondary leading-[1.4]">
            {t("table.deactivationBlockedDescription")}
          </p>
          <div className="flex justify-end">
            <button
              className="ui-button ui-button-secondary"
              onClick={() => setIsDeactivationBlocked(false)}
              type="button"
            >
              {t("table.understood")}
            </button>
          </div>
        </div>
      </Modal>

      <PublicationConfirmationModal
        description={
          pendingStatusChange?.destination === "telegram"
            ? t("table.telegramDeactivate")
            : pendingStatusChange?.destination === "person-hunter"
              ? pendingStatusChange?.isActive
                ? t("table.personHunterActivate")
                : t("table.personHunterDeactivate")
              : pendingStatusChange?.isActive
                ? t("table.hhActivate")
                : t("table.hhDeactivate")
        }
        isOpen={Boolean(pendingStatusChange)}
        isPending={updatePublicationStatus.isPending}
        onClose={() => setPendingStatusChange(null)}
        onConfirm={confirmStatusChange}
        onReject={() => setPendingStatusChange(null)}
        title={
          pendingStatusChange?.isActive
            ? t("table.activateQuestion")
            : t("table.deactivateQuestion")
        }
      />
    </div>
  );
}
