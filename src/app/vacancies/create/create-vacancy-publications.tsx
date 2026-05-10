"use client";

import { useEffect, useState } from "react";
import {
  ActionDropdown,
  type ActionDropdownItem,
} from "~/app/_components/action-dropdown";

const PUBLICATION_CHANNELS = ["linkedin", "hh.uz", "telegram"] as const;

type PublicationChannel = (typeof PUBLICATION_CHANNELS)[number];

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
  onConfigChange,
  onContinue,
  prefillDescription,
  prefillName,
}: {
  onBack: () => void;
  onConfigChange: (config: PublicationsConfig) => void;
  onContinue: () => void;
  prefillDescription: string;
  prefillName: string;
}) {
  const [selectedChannels, setSelectedChannels] = useState<
    PublicationChannel[]
  >([]);
  const [hydrated, setHydrated] = useState(false);

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
    if (isPublicationChannel(value)) {
      setSelectedChannels([value]);
    }
  };

  const selectedChannel = selectedChannels[0];

  return (
    <div className="mt-6 flex w-full flex-col gap-6">
      <h1 className="font-bold text-[44px] text-text-heading leading-none tracking-[-0.64px]">
        Создание публикации
      </h1>

      <div className="rounded-[8px] border border-border-input bg-bg-light p-4 lg:p-6">
        <div className="flex flex-col items-end gap-2">
          <ActionDropdown
            items={CHANNEL_OPTIONS}
            onSelect={handleChannelSelect}
            triggerLabel="Создать публикацию"
          />
          {selectedChannel && (
            <p className="text-[14px] text-text-secondary leading-none">
              Канал: {CHANNEL_DISPLAY_NAME[selectedChannel]}
            </p>
          )}
        </div>
      </div>

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
