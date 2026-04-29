"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Dropdown } from "~/app/_components/dropdown";
import { CheckIcon } from "~/app/_components/icons";
import { Input } from "~/app/_components/input";
import { Textarea } from "~/app/_components/textarea";
import { api } from "~/trpc/react";

const PUBLICATION_CHANNELS = ["telegram", "hh.uz"] as const;

type PublicationChannel = (typeof PUBLICATION_CHANNELS)[number];

const PUBLICATIONS_DRAFT_KEY = "vacancy-create:publications-draft:v1";

type HhDraft = {
  areaId: string;
  employmentId: string;
  scheduleId: string;
  experienceId: string;
  professionalRoleId: string;
  billingTypeId: string;
  salaryFrom: string;
  salaryTo: string;
  salaryCurrency: string;
  descriptionHtml: string;
  contactPhone: string;
};

type PublicationsDraft = {
  name: string;
  description: string;
  selectedChannels: PublicationChannel[];
  hh: HhDraft;
};

export type PublicationsConfig = {
  name: string;
  description: string;
  selectedChannels: PublicationChannel[];
  hh: HhDraft;
};

const EMPTY_HH_DRAFT: HhDraft = {
  areaId: "",
  employmentId: "",
  scheduleId: "",
  experienceId: "",
  professionalRoleId: "",
  billingTypeId: "",
  salaryFrom: "",
  salaryTo: "",
  salaryCurrency: "UZS",
  descriptionHtml: "",
  contactPhone: "",
};

function isPublicationChannel(value: unknown): value is PublicationChannel {
  return (
    typeof value === "string" &&
    (PUBLICATION_CHANNELS as readonly string[]).includes(value)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function pickString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function parseHhDraft(value: unknown): HhDraft {
  if (!isRecord(value)) {
    return EMPTY_HH_DRAFT;
  }
  return {
    areaId: pickString(value.areaId, ""),
    employmentId: pickString(value.employmentId, ""),
    scheduleId: pickString(value.scheduleId, ""),
    experienceId: pickString(value.experienceId, ""),
    professionalRoleId: pickString(value.professionalRoleId, ""),
    billingTypeId: pickString(value.billingTypeId, ""),
    salaryFrom: pickString(value.salaryFrom, ""),
    salaryTo: pickString(value.salaryTo, ""),
    salaryCurrency: pickString(value.salaryCurrency, "UZS"),
    descriptionHtml: pickString(value.descriptionHtml, ""),
    contactPhone: pickString(value.contactPhone, ""),
  };
}

export function CreateVacancyPublications({
  onCancel,
  onConfigChange,
  onContinue,
  prefillDescription,
  prefillName,
  prefillSalaryFrom,
  prefillSalaryCurrency,
}: {
  onCancel: () => void;
  onConfigChange: (config: PublicationsConfig) => void;
  onContinue: () => void;
  prefillDescription: string;
  prefillName: string;
  prefillSalaryFrom?: number;
  prefillSalaryCurrency?: string;
}) {
  const [name, setName] = useState(prefillName);
  const [description, setDescription] = useState(prefillDescription);
  const [selectedChannels, setSelectedChannels] = useState<
    PublicationChannel[]
  >([]);
  const [hh, setHh] = useState<HhDraft>(EMPTY_HH_DRAFT);
  const [hydrated, setHydrated] = useState(false);

  const hhSelected = selectedChannels.includes("hh.uz");

  const hhConfigQuery = api.vacancies.getHhConfig.useQuery();
  const hhLookupsQuery = api.vacancies.getHhPublishLookups.useQuery(undefined, {
    enabled: hhSelected,
    staleTime: 60 * 60 * 1000,
  });

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
        setHh(parseHhDraft(parsed.hh));
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
    const draft: PublicationsDraft = {
      name,
      description,
      selectedChannels,
      hh,
    };
    try {
      window.localStorage.setItem(
        PUBLICATIONS_DRAFT_KEY,
        JSON.stringify(draft),
      );
    } catch {
      // Ignore quota errors.
    }
  }, [name, description, selectedChannels, hh, hydrated]);

  const prefilledRef = useRef({
    salaryFrom: false,
    salaryCurrency: false,
    contactPhone: false,
    description: false,
  });

  useEffect(() => {
    if (!hydrated) return;
    setHh((previous) => {
      const next = { ...previous };
      let changed = false;

      if (
        !prefilledRef.current.salaryFrom &&
        !next.salaryFrom &&
        prefillSalaryFrom !== undefined
      ) {
        next.salaryFrom = String(prefillSalaryFrom);
        changed = true;
      }
      if (
        !prefilledRef.current.salaryCurrency &&
        prefillSalaryCurrency &&
        next.salaryCurrency !== prefillSalaryCurrency
      ) {
        next.salaryCurrency = prefillSalaryCurrency;
        changed = true;
      }
      if (
        !prefilledRef.current.contactPhone &&
        !next.contactPhone &&
        hhConfigQuery.data?.companyPhone
      ) {
        next.contactPhone = hhConfigQuery.data.companyPhone;
        changed = true;
      }
      if (
        !prefilledRef.current.description &&
        !next.descriptionHtml &&
        description
      ) {
        next.descriptionHtml = `<p>${description.replace(/\n+/g, "</p><p>")}</p>`;
        changed = true;
      }

      prefilledRef.current = {
        salaryFrom: true,
        salaryCurrency: true,
        contactPhone: true,
        description: true,
      };

      return changed ? next : previous;
    });
  }, [
    hydrated,
    prefillSalaryFrom,
    prefillSalaryCurrency,
    hhConfigQuery.data?.companyPhone,
    description,
  ]);

  useEffect(() => {
    onConfigChange({ name, description, selectedChannels, hh });
  }, [name, description, selectedChannels, hh, onConfigChange]);

  const toggleChannel = (channel: PublicationChannel) => {
    setSelectedChannels((previous) =>
      previous.includes(channel)
        ? previous.filter((selectedChannel) => selectedChannel !== channel)
        : [...previous, channel],
    );
  };

  const updateHh = <K extends keyof HhDraft>(field: K, value: HhDraft[K]) => {
    setHh((previous) => ({ ...previous, [field]: value }));
  };

  const areaOptions = useMemo(
    () =>
      (hhLookupsQuery.data?.areas ?? []).map((item) => ({
        value: item.id,
        label: item.name,
      })),
    [hhLookupsQuery.data?.areas],
  );

  const employmentOptions = useMemo(
    () =>
      (hhLookupsQuery.data?.employment ?? []).map((item) => ({
        value: item.id,
        label: item.name,
      })),
    [hhLookupsQuery.data?.employment],
  );

  const scheduleOptions = useMemo(
    () =>
      (hhLookupsQuery.data?.schedule ?? []).map((item) => ({
        value: item.id,
        label: item.name,
      })),
    [hhLookupsQuery.data?.schedule],
  );

  const experienceOptions = useMemo(
    () =>
      (hhLookupsQuery.data?.experience ?? []).map((item) => ({
        value: item.id,
        label: item.name,
      })),
    [hhLookupsQuery.data?.experience],
  );

  const professionalRoleOptions = useMemo(
    () =>
      (hhLookupsQuery.data?.professionalRoles ?? []).map((item) => ({
        value: item.id,
        label: item.name,
      })),
    [hhLookupsQuery.data?.professionalRoles],
  );

  const billingTypeOptions = useMemo(
    () =>
      (hhLookupsQuery.data?.billingType ?? []).map((item) => ({
        value: item.id,
        label: item.name,
      })),
    [hhLookupsQuery.data?.billingType],
  );

  const currencyOptions = useMemo(() => {
    const list = (hhLookupsQuery.data?.currency ?? []).map((item) => ({
      value: item.id,
      label: item.name,
    }));
    if (list.length === 0) {
      return [
        { value: "UZS", label: "UZS" },
        { value: "USD", label: "USD" },
      ];
    }
    return list;
  }, [hhLookupsQuery.data?.currency]);

  const hhAccountConnected = hhConfigQuery.data?.enabled === true;

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

          {hhSelected && (
            <div className="flex flex-col gap-4 rounded-[8px] border border-border-input bg-bg-input p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-semibold text-[18px] text-text-heading leading-none tracking-[-0.32px]">
                  Параметры публикации на hh.uz
                </h2>
                {!hhAccountConnected && (
                  <span className="rounded-[6px] bg-danger-red-bg px-2 py-1 text-[12px] text-danger-red">
                    Аккаунт hh.uz не подключён
                  </span>
                )}
              </div>

              {hhLookupsQuery.isLoading && (
                <div className="text-[14px] text-text-secondary">
                  Загрузка справочников hh.uz…
                </div>
              )}
              {hhLookupsQuery.isError && (
                <div className="rounded-[6px] border border-danger-red-bg bg-danger-red-bg px-3 py-2 text-[14px] text-danger-red">
                  Не удалось загрузить справочники hh.uz.{" "}
                  <button
                    className="underline"
                    onClick={() => void hhLookupsQuery.refetch()}
                    type="button"
                  >
                    Повторить
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Dropdown
                  label="Город (area)"
                  onChange={(value) => updateHh("areaId", value)}
                  options={areaOptions}
                  placeholder="Выберите город"
                  value={hh.areaId}
                />
                <Dropdown
                  label="Профессиональная роль"
                  onChange={(value) => updateHh("professionalRoleId", value)}
                  options={professionalRoleOptions}
                  placeholder="Выберите роль"
                  value={hh.professionalRoleId}
                />
                <Dropdown
                  label="Тип занятости"
                  onChange={(value) => updateHh("employmentId", value)}
                  options={employmentOptions}
                  placeholder="Выберите тип"
                  value={hh.employmentId}
                />
                <Dropdown
                  label="График работы"
                  onChange={(value) => updateHh("scheduleId", value)}
                  options={scheduleOptions}
                  placeholder="Выберите график"
                  value={hh.scheduleId}
                />
                <Dropdown
                  label="Опыт работы"
                  onChange={(value) => updateHh("experienceId", value)}
                  options={experienceOptions}
                  placeholder="Выберите опыт"
                  value={hh.experienceId}
                />
                <Dropdown
                  label="Тип публикации (billing)"
                  onChange={(value) => updateHh("billingTypeId", value)}
                  options={billingTypeOptions}
                  placeholder="Выберите тип публикации"
                  value={hh.billingTypeId}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <Input
                  inputMode="numeric"
                  label="Зарплата от"
                  onChange={(event) =>
                    updateHh("salaryFrom", event.target.value)
                  }
                  placeholder="например, 5 000 000"
                  value={hh.salaryFrom}
                />
                <Input
                  inputMode="numeric"
                  label="Зарплата до"
                  onChange={(event) => updateHh("salaryTo", event.target.value)}
                  placeholder="например, 8 000 000"
                  value={hh.salaryTo}
                />
                <Dropdown
                  label="Валюта"
                  onChange={(value) => updateHh("salaryCurrency", value)}
                  options={currencyOptions}
                  value={hh.salaryCurrency || "UZS"}
                />
              </div>

              <Input
                label="Контактный телефон (можно оставить пустым)"
                onChange={(event) =>
                  updateHh("contactPhone", event.target.value)
                }
                placeholder="+998 71 123 45 67"
                value={hh.contactPhone}
              />

              <Textarea
                className="min-h-[220px] font-mono text-[13px]"
                id="hh-description-html"
                label="Описание для hh.uz (HTML, минимум 200 символов)"
                maxLength={20000}
                onChange={(event) =>
                  updateHh("descriptionHtml", event.target.value)
                }
                placeholder="<p>О компании…</p><h3>Обязанности</h3><ul><li>…</li></ul>"
                value={hh.descriptionHtml}
              />
              <p className="text-[12px] text-text-secondary">
                Разрешены: &lt;p&gt;, &lt;ul&gt;, &lt;ol&gt;, &lt;li&gt;,
                &lt;strong&gt;, &lt;em&gt;, &lt;br&gt;, &lt;a&gt;, &lt;h3&gt;,
                &lt;h4&gt;. Описание должно содержать хотя бы один список.
              </p>
            </div>
          )}
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
