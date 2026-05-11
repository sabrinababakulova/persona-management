"use client";

import {
  ActionDropdown,
  type ActionDropdownItem,
} from "~/app/_components/action-dropdown";
import {
  type PublicationChannel,
  useVacancyPublicationStore,
} from "~/stores/vacancy-publication-store";
import { api } from "~/trpc/react";
import { PublicationsTable } from "./publications-table";

export type { PublicationChannel } from "~/stores/vacancy-publication-store";

/** Local copy of the channel list used for the `isPublicationChannel` type guard. */
const PUBLICATION_CHANNELS = ["linkedin", "hh.uz", "telegram"] as const;

/** Dropdown entries shown when the user opens the "Создать публикацию" menu. */
const CHANNEL_OPTIONS: ActionDropdownItem[] = [
  { value: "linkedin", label: "Для LinkedIn", iconSrc: "/linkedin.svg" },
  { value: "hh.uz", label: "Для HH", iconSrc: "/hh.svg" },
  { value: "telegram", label: "Для Telegram", iconSrc: "/telegram.svg" },
];

/** Human-readable name shown under the dropdown after a channel is picked. */
const CHANNEL_DISPLAY_NAME: Record<PublicationChannel, string> = {
  linkedin: "LinkedIn",
  "hh.uz": "HH",
  telegram: "Telegram",
};

/** Type guard that narrows an unknown value to one of {@link PUBLICATION_CHANNELS}. */
function isPublicationChannel(value: unknown): value is PublicationChannel {
  return (
    typeof value === "string" &&
    (PUBLICATION_CHANNELS as readonly string[]).includes(value)
  );
}

/**
 * Publications step of the vacancy creation flow.
 *
 * - When the vacancy already has saved publications, renders the
 *   {@link PublicationsTable} with the "Создать публикацию" dropdown in its header.
 * - Otherwise renders a single right-aligned dropdown card.
 *
 * Picking a channel writes to `selectedChannels` in the shared Zustand store and triggers
 * {@link onChannelLaunch}, which the parent uses to persist the vacancy as a draft and route to
 * the per-channel editor.
 */
export function CreateVacancyPublications({
  onBack,
  onChannelLaunch,
  onContinue,
  vacancyId,
}: {
  /** Sends the user back to the description step. */
  onBack: () => void;
  /** Called with the picked channel after the user opens the dropdown and selects an item. */
  onChannelLaunch?: (channel: PublicationChannel) => void;
  /** Advances to the preview / publish step. */
  onContinue: () => void;
  /** Vacancy ID used to fetch existing publications. Omit during early create-flow stages. */
  vacancyId?: string;
}) {
  const selectedChannels = useVacancyPublicationStore(
    (s) => s.selectedChannels,
  );
  const setSelectedChannels = useVacancyPublicationStore(
    (s) => s.setSelectedChannels,
  );

  const publicationsQuery = api.vacancies.listPublications.useQuery(
    { vacancyId: vacancyId ?? "" },
    { enabled: Boolean(vacancyId) },
  );
  const publications = publicationsQuery.data ?? [];
  const hasExistingPublications = publications.length > 0;

  const handleChannelSelect = (value: string) => {
    if (!isPublicationChannel(value)) {
      return;
    }
    setSelectedChannels([value]);
    onChannelLaunch?.(value);
  };

  const selectedChannel = selectedChannels[0];

  const dropdown = (
    <ActionDropdown
      items={CHANNEL_OPTIONS}
      onSelect={handleChannelSelect}
      triggerLabel="Создать публикацию"
    />
  );

  return (
    <div className="mt-6 flex w-full flex-col gap-6">
      {!hasExistingPublications && (
        <h1 className="font-bold text-[44px] text-text-heading leading-none tracking-[-0.64px]">
          Создание публикации
        </h1>
      )}

      {hasExistingPublications ? (
        <PublicationsTable
          publications={publications}
          trailingHeader={dropdown}
        />
      ) : (
        <div className="rounded-[8px] border border-border-input bg-bg-light p-4 lg:p-6">
          <div className="flex flex-col items-end gap-2">
            {dropdown}
            {selectedChannel && (
              <p className="text-[14px] text-text-secondary leading-none">
                Канал: {CHANNEL_DISPLAY_NAME[selectedChannel]}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center justify-end gap-3 border-border-input border-t pt-4">
        <button
          className="h-10 rounded-[6px] border border-border-input px-4 font-semibold text-[16px] text-text-secondary leading-none tracking-[-0.32px] transition-colors hover:bg-bg-hover"
          onClick={onBack}
          type="button"
        >
          Назад
        </button>
        <button
          className="h-10 rounded-[6px] bg-primary-blue-light px-4 font-semibold text-[16px] text-primary-blue leading-none tracking-[-0.32px] transition-colors hover:bg-primary-blue-light-hover"
          onClick={onContinue}
          type="button"
        >
          Продолжить
        </button>
      </div>
    </div>
  );
}
