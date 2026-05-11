"use client";

import { useEffect, useState } from "react";
import {
  ActionDropdown,
  type ActionDropdownItem,
} from "~/app/_components/action-dropdown";
import { api } from "~/trpc/react";
import { PublicationsTable } from "./publications-table";

const PUBLICATION_CHANNELS = ["linkedin", "hh.uz", "telegram"] as const;

export type PublicationChannel = (typeof PUBLICATION_CHANNELS)[number];

const CHANNEL_OPTIONS: ActionDropdownItem[] = [
  { value: "linkedin", label: "Для LinkedIn", iconSrc: "/linkedin.svg" },
  { value: "hh.uz", label: "Для HH", iconSrc: "/hh.svg" },
  { value: "telegram", label: "Для Telegram", iconSrc: "/telegram.svg" },
];

const CHANNEL_DISPLAY_NAME: Record<PublicationChannel, string> = {
  linkedin: "LinkedIn",
  "hh.uz": "HH",
  telegram: "Telegram",
};

const PUBLICATIONS_DRAFT_KEY = "vacancy-create:publications-draft:v1";

type PublicationsDraft = {
  selectedChannels: PublicationChannel[];
};

export type PublicationsConfig = {
  name: string;
  description: string;
  selectedChannels: PublicationChannel[];
};

/** Type guard that narrows an unknown value to one of {@link PUBLICATION_CHANNELS}. */
function isPublicationChannel(value: unknown): value is PublicationChannel {
  return (
    typeof value === "string" &&
    (PUBLICATION_CHANNELS as readonly string[]).includes(value)
  );
}

export function CreateVacancyPublications({
  onBack,
  onChannelLaunch,
  onConfigChange,
  onContinue,
  prefillDescription,
  prefillName,
  vacancyId,
}: {
  onBack: () => void;
  onChannelLaunch?: (channel: PublicationChannel) => void;
  onConfigChange: (config: PublicationsConfig) => void;
  onContinue: () => void;
  prefillDescription: string;
  prefillName: string;
  vacancyId?: string;
}) {
  const [selectedChannels, setSelectedChannels] = useState<
    PublicationChannel[]
  >([]);
  const [hydrated, setHydrated] = useState(false);

  const publicationsQuery = api.vacancies.listPublications.useQuery(
    { vacancyId: vacancyId ?? "" },
    { enabled: Boolean(vacancyId) },
  );
  const publications = publicationsQuery.data ?? [];
  const hasExistingPublications = publications.length > 0;

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(PUBLICATIONS_DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PublicationsDraft>;
        if (Array.isArray(parsed.selectedChannels)) {
          setSelectedChannels(
            parsed.selectedChannels.filter(isPublicationChannel),
          );
        }
      }
    } catch {
      // Ignore corrupt drafts.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    const draft: PublicationsDraft = { selectedChannels };
    try {
      window.localStorage.setItem(
        PUBLICATIONS_DRAFT_KEY,
        JSON.stringify(draft),
      );
    } catch {
      // Ignore quota errors.
    }
  }, [selectedChannels, hydrated]);

  useEffect(() => {
    onConfigChange({
      name: prefillName,
      description: prefillDescription,
      selectedChannels,
    });
  }, [prefillName, prefillDescription, selectedChannels, onConfigChange]);

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

export const PUBLICATIONS_DRAFT_STORAGE_KEY = PUBLICATIONS_DRAFT_KEY;
