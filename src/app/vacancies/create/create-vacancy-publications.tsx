"use client";

import { useEffect, useState } from "react";
import { CheckIcon } from "~/app/_components/icons";
import { Input } from "~/app/_components/input";
import { Textarea } from "~/app/_components/textarea";

const PUBLICATION_CHANNELS = ["telegram", "hh.uz"] as const;

type PublicationChannel = (typeof PUBLICATION_CHANNELS)[number];

const PUBLICATIONS_DRAFT_KEY = "vacancy-create:publications-draft:v1";

type PublicationsDraft = {
  name: string;
  description: string;
  selectedChannels: PublicationChannel[];
};

function isPublicationChannel(value: unknown): value is PublicationChannel {
  return (
    typeof value === "string" &&
    (PUBLICATION_CHANNELS as readonly string[]).includes(value)
  );
}

export function CreateVacancyPublications({
  onCancel,
  onContinue,
  prefillDescription,
  prefillName,
}: {
  onCancel: () => void;
  onContinue: () => void;
  prefillDescription: string;
  prefillName: string;
}) {
  const [name, setName] = useState(prefillName);
  const [description, setDescription] = useState(prefillDescription);
  const [selectedChannels, setSelectedChannels] = useState<
    PublicationChannel[]
  >([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(PUBLICATIONS_DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PublicationsDraft>;
        if (typeof parsed.name === "string") {
          setName(parsed.name);
        }
        if (typeof parsed.description === "string") {
          setDescription(parsed.description);
        }
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
    const draft: PublicationsDraft = { name, description, selectedChannels };
    try {
      window.localStorage.setItem(
        PUBLICATIONS_DRAFT_KEY,
        JSON.stringify(draft),
      );
    } catch {
      // Ignore quota errors.
    }
  }, [name, description, selectedChannels, hydrated]);

  const toggleChannel = (channel: PublicationChannel) => {
    setSelectedChannels((previous) =>
      previous.includes(channel)
        ? previous.filter((selectedChannel) => selectedChannel !== channel)
        : [...previous, channel],
    );
  };

  return (
    <div className="mt-6 flex w-full flex-col gap-6">
      <h1 className="font-bold text-[44px] text-text-heading leading-none tracking-[-0.64px]">
        Создание публикации
      </h1>

      <div className="rounded-[8px] border border-border-input bg-bg-light p-4 lg:p-6">
        <div className="flex flex-col gap-6">
          <Input
            label="Название публикации"
            maxLength={255}
            onChange={(event) => setName(event.target.value)}
            placeholder="Введите название публикации"
            value={name}
          />

          <Textarea
            className="min-h-[180px]"
            id="publication-vacancy-description"
            label="Описание вакансии"
            maxLength={8000}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Опишите вакансию для публикации"
            value={description}
          />

          <fieldset className="flex flex-col gap-3">
            <legend className="mb-1 font-medium text-[16px] text-text-label leading-[1.4] tracking-[-0.32px]">
              Каналы публикации
            </legend>

            <div className="flex flex-col gap-3">
              {PUBLICATION_CHANNELS.map((channel) => (
                <label
                  className="flex cursor-pointer items-center gap-3 rounded-[6px] border border-border-input bg-bg-input px-3 py-3 transition-colors hover:border-primary-blue"
                  key={channel}
                >
                  <input
                    checked={selectedChannels.includes(channel)}
                    className="sr-only"
                    onChange={() => toggleChannel(channel)}
                    type="checkbox"
                    value={channel}
                  />
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded border transition-colors ${
                      selectedChannels.includes(channel)
                        ? "border-checkbox-blue bg-checkbox-blue"
                        : "border-border-light bg-bg-light"
                    }`}
                  >
                    {selectedChannels.includes(channel) && (
                      <CheckIcon className="h-3.5 w-3.5 text-bg-light" />
                    )}
                  </span>
                  <span className="font-medium text-[16px] text-text-heading leading-none tracking-[-0.32px]">
                    {channel}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-end gap-3 border-border-input border-t pt-4">
        <button
          className="h-10 rounded-[6px] border border-border-input px-4 font-semibold text-[16px] text-text-secondary leading-none tracking-[-0.32px] transition-colors hover:bg-bg-hover"
          onClick={onCancel}
          type="button"
        >
          Отмена
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
