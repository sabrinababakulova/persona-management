"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Breadcrumbs } from "~/app/_components/Breadcrumbs";
import { ClosableSection } from "~/app/_components/closable-section";
import { Dropdown } from "~/app/_components/dropdown";
import { FormProgress } from "~/app/_components/form-progress";
import { Input } from "~/app/_components/input";
import { Modal } from "~/app/_components/modal";
import { RichTextEditor } from "~/app/_components/rich-text-editor";
import { SearchableSelect } from "~/app/_components/searchable-select";
import { SideMenu } from "~/app/_components/sideMenu";
import { api } from "~/trpc/react";
import {
  formatNumberWithSpaces,
  parseFormattedNumber,
} from "~/utils/format-salaries";
import {
  CreateVacancyPublications,
  PUBLICATIONS_DRAFT_STORAGE_KEY,
  type PublicationsConfig,
} from "./create-vacancy-publications";

const HH_DRAFT_KEY = "vacancy-create:hh-draft:v1";

const SIDE_MENU_ITEMS = [
  { id: "description", label: "Описание вакансии" },
  { id: "publications", label: "Публикации" },
  { id: "preview", label: "Предпросмотр" },
] as const;

const FALLBACK_CURRENCY_OPTIONS = [
  { value: "UZS", label: "UZS" },
  { value: "USD", label: "USD" },
];

type HhFormData = {
  name: string;
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

type HhFormErrors = Partial<Record<keyof HhFormData | "_form", string>>;

const REQUIRED_FIELDS: ReadonlyArray<{
  key: keyof HhFormData;
  label: string;
}> = [
  { key: "name", label: "Название вакансии" },
  { key: "areaId", label: "Город" },
  { key: "professionalRoleId", label: "Профессиональная роль" },
  { key: "employmentId", label: "Тип занятости" },
  { key: "scheduleId", label: "График работы" },
  { key: "experienceId", label: "Опыт работы" },
  { key: "billingTypeId", label: "Тип публикации" },
  { key: "descriptionHtml", label: "Описание" },
];

const EMPTY_FORM: HhFormData = {
  name: "",
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

/**
 * Returns true when the supplied HTML contains visible text content.
 * Strips tags so an "empty" rich-text editor (e.g. `<p></p>`) is treated as blank.
 */
function hasMeaningfulHtml(html: string): boolean {
  return html.replace(/<[^>]*>/g, "").trim().length > 0;
}

/**
 * Removes duplicate options by `value`, keeping the first occurrence.
 *
 * hh.ru returns the same `professionalRoles` id under multiple category groups, which
 * collides on the `<option key={value}>` we pass to the Dropdown. Deduping by value
 * keeps the dropdown valid (a `<select>` can't have two options with the same value
 * anyway) and works for areas/roles/employment/etc. uniformly.
 */
function dedupeOptionsByValue<T extends { value: string }>(options: T[]): T[] {
  const seen = new Set<string>();
  return options.filter((option) => {
    if (seen.has(option.value)) {
      return false;
    }
    seen.add(option.value);
    return true;
  });
}

/**
 * Splits a phone number string into the `{ country, city, number }` tuple expected by the hh.uz API.
 *
 * - `+998 (XX) XXX-XX-XX` style numbers map directly to country `998`.
 * - Bare 9-digit numbers are assumed to be Uzbek and prefixed with `998`.
 * - Other lengths fall back to slicing the trailing 9 digits as the local number.
 *
 * Returns null when the digit count is below 9, which means it cannot be turned into a valid tuple.
 */
function parseHhPhoneClient(raw: string): {
  country: string;
  city: string;
  number: string;
} | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 9) return null;
  if (digits.startsWith("998") && digits.length >= 12) {
    return {
      country: "998",
      city: digits.slice(3, 5),
      number: digits.slice(5),
    };
  }
  if (digits.length === 9) {
    return {
      country: "998",
      city: digits.slice(0, 2),
      number: digits.slice(2),
    };
  }
  return {
    country: digits.slice(0, digits.length - 9),
    city: digits.slice(digits.length - 9, digits.length - 7),
    number: digits.slice(digits.length - 7),
  };
}

/**
 * Multi-step form that creates a vacancy and (optionally) publishes it to hh.uz / Telegram.
 *
 * Steps:
 * - `description` — collects every field hh.uz requires (name, area, role, employment, schedule,
 *   experience, billing type, salary range, contact phone and the HTML description).
 * - `publications` — lets the user choose distribution channels (Telegram and/or hh.uz).
 * - `preview` — submits the vacancy via tRPC and opens a publish modal so each selected channel
 *   can be triggered.
 *
 * Drafts are persisted to localStorage under {@link HH_DRAFT_KEY} so a refresh keeps the work in progress.
 */
export function CreateVacancyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const utils = api.useUtils();
  const stepParam = searchParams.get("step");
  const activeSectionId =
    stepParam && SIDE_MENU_ITEMS.some((item) => item.id === stepParam)
      ? stepParam
      : SIDE_MENU_ITEMS[0].id;

  /** Pushes the user to the requested step via the `?step=` query parameter. */
  const goToStep = (id: string) => {
    router.push(`/vacancies/create?step=${id}`);
  };

  const [savedVacancyId, setSavedVacancyId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [telegramStatus, setTelegramStatus] = useState<
    "idle" | "sending" | "sent" | "error"
  >("idle");
  const [hhStatus, setHhStatus] = useState<
    "idle" | "sending" | "sent" | "error"
  >("idle");
  const [hhError, setHhError] = useState<string | null>(null);
  const [publishedHhUrl, setPublishedHhUrl] = useState<string | null>(null);
  const [publicationsConfig, setPublicationsConfig] =
    useState<PublicationsConfig | null>(null);

  /** Stable callback passed to the publications step so it can report channel changes upward. */
  const handlePublicationsConfigChange = useCallback(
    (config: PublicationsConfig) => {
      setPublicationsConfig(config);
    },
    [],
  );

  const [errors, setErrors] = useState<HhFormErrors>({});
  const [hydrated, setHydrated] = useState(false);
  const [formData, setFormData] = useState<HhFormData>(EMPTY_FORM);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(HH_DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<HhFormData>;
        setFormData((previous) => ({ ...previous, ...parsed }));
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
    try {
      window.localStorage.setItem(HH_DRAFT_KEY, JSON.stringify(formData));
    } catch {
      // Ignore quota errors.
    }
  }, [formData, hydrated]);

  /** Removes the description and publications drafts from localStorage. */
  const clearDrafts = () => {
    try {
      window.localStorage.removeItem(HH_DRAFT_KEY);
      window.localStorage.removeItem(PUBLICATIONS_DRAFT_STORAGE_KEY);
    } catch {
      // Ignore.
    }
  };

  const { data: telegramConfig } = api.vacancies.getTelegramConfig.useQuery();
  const hhConfigQuery = api.vacancies.getHhConfig.useQuery();
  const hhLookupsQuery = api.vacancies.getHhPublishLookups.useQuery();

  useEffect(() => {
    if (!hydrated) return;
    const companyPhone = hhConfigQuery.data?.companyPhone;
    if (!companyPhone) return;
    setFormData((previous) =>
      previous.contactPhone
        ? previous
        : { ...previous, contactPhone: companyPhone },
    );
  }, [hydrated, hhConfigQuery.data?.companyPhone]);

  const areaOptions = useMemo(
    () =>
      dedupeOptionsByValue(
        (hhLookupsQuery.data?.areas ?? []).map((item) => ({
          value: item.id,
          label: item.name,
        })),
      ),
    [hhLookupsQuery.data?.areas],
  );

  const employmentOptions = useMemo(
    () =>
      dedupeOptionsByValue(
        (hhLookupsQuery.data?.employment ?? []).map((item) => ({
          value: item.id,
          label: item.name,
        })),
      ),
    [hhLookupsQuery.data?.employment],
  );

  const scheduleOptions = useMemo(
    () =>
      dedupeOptionsByValue(
        (hhLookupsQuery.data?.schedule ?? []).map((item) => ({
          value: item.id,
          label: item.name,
        })),
      ),
    [hhLookupsQuery.data?.schedule],
  );

  const experienceOptions = useMemo(
    () =>
      dedupeOptionsByValue(
        (hhLookupsQuery.data?.experience ?? []).map((item) => ({
          value: item.id,
          label: item.name,
        })),
      ),
    [hhLookupsQuery.data?.experience],
  );

  const professionalRoleOptions = useMemo(
    () =>
      dedupeOptionsByValue(
        (hhLookupsQuery.data?.professionalRoles ?? []).map((item) => ({
          value: item.id,
          label: item.name,
        })),
      ),
    [hhLookupsQuery.data?.professionalRoles],
  );

  const billingTypeOptions = useMemo(
    () =>
      dedupeOptionsByValue(
        (hhLookupsQuery.data?.billingType ?? []).map((item) => ({
          value: item.id,
          label: item.name,
        })),
      ),
    [hhLookupsQuery.data?.billingType],
  );

  const currencyOptions = useMemo(() => {
    const list = dedupeOptionsByValue(
      (hhLookupsQuery.data?.currency ?? []).map((item) => ({
        value: item.id,
        label: item.name,
      })),
    );
    return list.length === 0 ? FALLBACK_CURRENCY_OPTIONS : list;
  }, [hhLookupsQuery.data?.currency]);

  const progress = useMemo(() => {
    const missing = REQUIRED_FIELDS.filter(({ key }) => {
      if (key === "descriptionHtml") {
        return !hasMeaningfulHtml(formData.descriptionHtml);
      }
      return formData[key].trim() === "";
    }).map(({ label }) => label);

    return {
      total: REQUIRED_FIELDS.length,
      filled: REQUIRED_FIELDS.length - missing.length,
      missing,
      percentage: Math.round(
        ((REQUIRED_FIELDS.length - missing.length) / REQUIRED_FIELDS.length) *
          100,
      ),
    };
  }, [formData]);

  const hhSelected =
    publicationsConfig?.selectedChannels.includes("hh.uz") ?? false;
  const telegramSelected =
    publicationsConfig?.selectedChannels.includes("telegram") ?? false;

  const createVacancy = api.vacancies.create.useMutation({
    onSuccess: async (createdVacancy) => {
      await utils.vacancies.list.invalidate();
      clearDrafts();

      const willOfferTelegram =
        telegramConfig?.enabled === true && telegramSelected;
      const willOfferHh = hhConfigQuery.data?.enabled === true && hhSelected;

      if (willOfferTelegram || willOfferHh) {
        setSavedVacancyId(createdVacancy.id);
        setModalOpen(true);
        return;
      }

      router.push("/vacancies");
    },
    onError: (error) => {
      setErrors((previous) => ({
        ...previous,
        _form: error.message || "Не удалось сохранить вакансию",
      }));
    },
  });

  const postToTelegram = api.vacancies.publishTelegram.useMutation({
    onSuccess: () => {
      setTelegramStatus("sent");
    },
    onError: () => {
      setTelegramStatus("error");
    },
  });

  const postToHh = api.vacancies.publishHh.useMutation({
    onSuccess: (data) => {
      setHhStatus("sent");
      setHhError(null);
      setPublishedHhUrl(data.url);
    },
    onError: (error) => {
      setHhStatus("error");
      setHhError(error.message || "Не удалось опубликовать на hh.uz");
    },
  });

  /**
   * Updates a single form field and clears any pre-existing per-field or form-level error.
   * Generic over the field key so the value type is statically checked.
   */
  const handleFieldChange = <K extends keyof HhFormData>(
    field: K,
    value: HhFormData[K],
  ) => {
    setFormData((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => {
      if (!previous[field] && !previous._form) {
        return previous;
      }

      return {
        ...previous,
        [field]: undefined,
        _form: undefined,
      };
    });
  };

  /** Closes the publish modal and resets the per-channel publish status. */
  const closeModal = () => {
    setModalOpen(false);
    setTelegramStatus("idle");
    setHhStatus("idle");
    setHhError(null);
    setPublishedHhUrl(null);
  };

  /** Re-opens the publish modal (after the user has saved but navigated away). */
  const reopenModal = () => {
    setHhStatus("idle");
    setHhError(null);
    setPublishedHhUrl(null);
    setTelegramStatus("idle");
    setModalOpen(true);
  };

  /** Closes the publish modal and sends the user back to the description step to fix hh.uz fields. */
  const goEditHhFields = () => {
    setModalOpen(false);
    setHhStatus("idle");
    setHhError(null);
    goToStep("description");
  };

  /**
   * Validates the hh.uz-required fields in {@link formData} and triggers the publish mutation.
   * Surfaces a `hhError` if anything is missing so the modal can prompt the user to fix it.
   */
  const triggerHhPublish = () => {
    if (!savedVacancyId) {
      return;
    }

    const requiredHhFields: Array<[keyof HhFormData, string]> = [
      ["areaId", "город"],
      ["employmentId", "тип занятости"],
      ["scheduleId", "график"],
      ["experienceId", "опыт"],
      ["professionalRoleId", "профессиональная роль"],
      ["billingTypeId", "тип публикации"],
      ["descriptionHtml", "HTML-описание"],
    ];
    const missing = requiredHhFields
      .filter(([key]) => {
        if (key === "descriptionHtml") {
          return !hasMeaningfulHtml(formData.descriptionHtml);
        }
        return !formData[key].trim();
      })
      .map(([, label]) => label);

    if (missing.length > 0) {
      setHhStatus("error");
      setHhError(`Заполните поля hh.uz: ${missing.join(", ")}`);
      return;
    }

    setHhStatus("sending");
    setHhError(null);

    const parsedFrom = formData.salaryFrom
      ? parseFormattedNumber(formData.salaryFrom)
      : undefined;
    const parsedTo = formData.salaryTo
      ? parseFormattedNumber(formData.salaryTo)
      : undefined;

    postToHh.mutate({
      vacancyId: savedVacancyId,
      name: formData.name,
      descriptionHtml: formData.descriptionHtml,
      areaId: formData.areaId,
      employmentId: formData.employmentId,
      scheduleId: formData.scheduleId,
      experienceId: formData.experienceId,
      professionalRoleId: formData.professionalRoleId,
      billingTypeId: formData.billingTypeId,
      salaryFrom: parsedFrom,
      salaryTo: parsedTo,
      salaryCurrency: formData.salaryCurrency || "UZS",
      contactPhone: formData.contactPhone
        ? parseHhPhoneClient(formData.contactPhone)
        : null,
    });
  };

  /**
   * Validates the description step.
   *
   * Required: name, area, role, employment, schedule, experience, billing type and a non-empty
   * description of at least 200 characters (the same minimum the server enforces).
   *
   * Returns true and clears errors on success; otherwise sets per-field error messages and returns false.
   */
  const validateForm = (): boolean => {
    const nextErrors: HhFormErrors = {};

    if (!formData.name.trim()) {
      nextErrors.name = "Введите название вакансии";
    }
    if (!formData.areaId) {
      nextErrors.areaId = "Выберите город";
    }
    if (!formData.professionalRoleId) {
      nextErrors.professionalRoleId = "Выберите профессиональную роль";
    }
    if (!formData.employmentId) {
      nextErrors.employmentId = "Выберите тип занятости";
    }
    if (!formData.scheduleId) {
      nextErrors.scheduleId = "Выберите график";
    }
    if (!formData.experienceId) {
      nextErrors.experienceId = "Выберите опыт";
    }
    if (!formData.billingTypeId) {
      nextErrors.billingTypeId = "Выберите тип публикации";
    }
    if (!hasMeaningfulHtml(formData.descriptionHtml)) {
      nextErrors.descriptionHtml = "Заполните описание вакансии";
    } else if (formData.descriptionHtml.length < 200) {
      nextErrors.descriptionHtml =
        "Описание должно быть не короче 200 символов";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return false;
    }

    setErrors({});
    return true;
  };

  /** Validates the form and advances to the publications step. */
  const handleContinueFromDescription = () => {
    if (!validateForm()) {
      return;
    }
    goToStep("publications");
  };

  /** From the publications step: opens the publish modal if already saved, else moves to preview. */
  const handleContinueFromPublications = () => {
    if (savedVacancyId) {
      reopenModal();
      return;
    }
    goToStep("preview");
  };

  /** Discards drafts and returns the user to the vacancies list. */
  const handleCancel = () => {
    clearDrafts();
    router.push("/vacancies");
  };

  /**
   * Final-step handler.
   * Validates the description fields and calls the create-vacancy mutation, using the hh.uz `name`
   * as the vacancy title. Other vacancy columns fall back to their server-side defaults.
   */
  const handleSubmit = () => {
    if (!validateForm()) {
      return;
    }

    setTelegramStatus("idle");

    createVacancy.mutate({
      title: formData.name.trim(),
      status: "draft",
    });
  };

  return (
    <div className="relative w-full">
      <div className="flex w-full gap-[64px] px-6 pt-8 pb-8">
        <SideMenu
          activeId={activeSectionId}
          items={SIDE_MENU_ITEMS.map((item) => ({
            ...item,
            disabled:
              item.id !== "description" &&
              !(
                formData.name.trim() &&
                hasMeaningfulHtml(formData.descriptionHtml)
              ),
          }))}
          onSelect={goToStep}
        />

        <section className="flex flex-3 flex-col">
          <div className="w-full max-w-[900px]">
            <Breadcrumbs
              label="Добавление вакансии"
              rootHref="/vacancies"
              rootLabel="Вакансии"
            />

            {activeSectionId === "description" ? (
              <>
                <div className="mt-6 mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h1 className="font-bold text-[44px] text-text-heading leading-none tracking-[-0.64px]">
                    Добавление вакансии
                  </h1>
                </div>

                <FormProgress
                  filled={progress.filled}
                  missing={progress.missing}
                  percentage={progress.percentage}
                  total={progress.total}
                />

                {hhLookupsQuery.isError && (
                  <div className="mt-4 rounded-[6px] border border-danger-red-bg bg-danger-red-bg px-3 py-2 text-[14px] text-danger-red">
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

                <div className="flex flex-col gap-8 lg:flex-row lg:gap-16">
                  <div className="min-w-0 flex-1 space-y-8">
                    <div
                      className="scroll-mt-24 rounded-[8px] border border-border-input bg-bg-light p-4 lg:p-6"
                      id="basic-information"
                    >
                      <ClosableSection title="Основная информация">
                        <div className="flex min-w-0 flex-col gap-2">
                          <Input
                            label="Название вакансии"
                            maxLength={255}
                            onChange={(event) =>
                              handleFieldChange("name", event.target.value)
                            }
                            placeholder="Например, Frontend Developer"
                            value={formData.name}
                          />
                          {errors.name && (
                            <p className="text-[13px] text-danger-red leading-[1.4]">
                              {errors.name}
                            </p>
                          )}
                        </div>

                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                          <div className="flex min-w-0 flex-col gap-2">
                            <SearchableSelect
                              label="Город"
                              onChange={(value) =>
                                handleFieldChange("areaId", value)
                              }
                              options={areaOptions}
                              placeholder="Выберите город"
                              searchPlaceholder="Найти город"
                              value={formData.areaId}
                            />
                            {errors.areaId && (
                              <p className="text-[13px] text-danger-red leading-[1.4]">
                                {errors.areaId}
                              </p>
                            )}
                          </div>

                          <div className="flex min-w-0 flex-col gap-2">
                            <SearchableSelect
                              label="Профессиональная роль"
                              onChange={(value) =>
                                handleFieldChange("professionalRoleId", value)
                              }
                              options={professionalRoleOptions}
                              placeholder="Выберите роль"
                              searchPlaceholder="Найти роль"
                              value={formData.professionalRoleId}
                            />
                            {errors.professionalRoleId && (
                              <p className="text-[13px] text-danger-red leading-[1.4]">
                                {errors.professionalRoleId}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                          <div className="flex min-w-0 flex-col gap-2">
                            <Dropdown
                              label="Тип занятости"
                              onChange={(value) =>
                                handleFieldChange("employmentId", value)
                              }
                              options={employmentOptions}
                              placeholder="Выберите тип"
                              value={formData.employmentId}
                            />
                            {errors.employmentId && (
                              <p className="text-[13px] text-danger-red leading-[1.4]">
                                {errors.employmentId}
                              </p>
                            )}
                          </div>

                          <div className="flex min-w-0 flex-col gap-2">
                            <Dropdown
                              label="График работы"
                              onChange={(value) =>
                                handleFieldChange("scheduleId", value)
                              }
                              options={scheduleOptions}
                              placeholder="Выберите график"
                              value={formData.scheduleId}
                            />
                            {errors.scheduleId && (
                              <p className="text-[13px] text-danger-red leading-[1.4]">
                                {errors.scheduleId}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                          <div className="flex min-w-0 flex-col gap-2">
                            <Dropdown
                              label="Опыт работы"
                              onChange={(value) =>
                                handleFieldChange("experienceId", value)
                              }
                              options={experienceOptions}
                              placeholder="Выберите опыт"
                              value={formData.experienceId}
                            />
                            {errors.experienceId && (
                              <p className="text-[13px] text-danger-red leading-[1.4]">
                                {errors.experienceId}
                              </p>
                            )}
                          </div>

                          <div className="flex min-w-0 flex-col gap-2">
                            <Dropdown
                              label="Тип публикации"
                              onChange={(value) =>
                                handleFieldChange("billingTypeId", value)
                              }
                              options={billingTypeOptions}
                              placeholder="Выберите тип публикации"
                              value={formData.billingTypeId}
                            />
                            {errors.billingTypeId && (
                              <p className="text-[13px] text-danger-red leading-[1.4]">
                                {errors.billingTypeId}
                              </p>
                            )}
                          </div>
                        </div>
                      </ClosableSection>
                    </div>

                    <div
                      className="scroll-mt-24 rounded-[8px] border border-border-input bg-bg-light p-4 lg:p-6"
                      id="conditions"
                    >
                      <ClosableSection title="Условия">
                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                          <Input
                            inputMode="numeric"
                            label="Зарплата от"
                            maxLength={20}
                            onChange={(event) =>
                              handleFieldChange(
                                "salaryFrom",
                                formatNumberWithSpaces(event.target.value),
                              )
                            }
                            placeholder="например, 5 000 000"
                            value={formData.salaryFrom}
                          />
                          <Input
                            inputMode="numeric"
                            label="Зарплата до"
                            maxLength={20}
                            onChange={(event) =>
                              handleFieldChange(
                                "salaryTo",
                                formatNumberWithSpaces(event.target.value),
                              )
                            }
                            placeholder="например, 8 000 000"
                            value={formData.salaryTo}
                          />
                          <Dropdown
                            label="Валюта"
                            onChange={(value) =>
                              handleFieldChange("salaryCurrency", value)
                            }
                            options={currencyOptions}
                            value={formData.salaryCurrency || "UZS"}
                          />
                        </div>

                        <Input
                          label="Контактный телефон (можно оставить пустым)"
                          onChange={(event) =>
                            handleFieldChange(
                              "contactPhone",
                              event.target.value,
                            )
                          }
                          placeholder="+998 71 123 45 67"
                          value={formData.contactPhone}
                        />
                      </ClosableSection>
                    </div>

                    <div
                      className="scroll-mt-24 rounded-[8px] border border-border-input bg-bg-light p-4 lg:p-6"
                      id="description"
                    >
                      <ClosableSection title="Описание">
                        <RichTextEditor
                          id="hh-description-html"
                          label="Описание для hh.uz (минимум 200 символов)"
                          maxLength={20000}
                          onChange={(html) =>
                            handleFieldChange("descriptionHtml", html)
                          }
                          placeholder="Опишите вакансию: обязанности, требования, условия. Используйте списки и заголовки."
                          value={formData.descriptionHtml}
                        />
                        {errors.descriptionHtml && (
                          <p className="text-[13px] text-danger-red leading-[1.4]">
                            {errors.descriptionHtml}
                          </p>
                        )}
                        <p className="text-[12px] text-text-secondary">
                          hh.uz принимает только базовое форматирование: абзацы,
                          списки, заголовки H3/H4, жирный, курсив и ссылки.
                          Описание должно содержать хотя бы один список.
                        </p>
                      </ClosableSection>
                    </div>
                  </div>
                </div>

                <div className="sticky bottom-0 z-10 mt-8 border-border-input border-t bg-bg-light py-4 backdrop-blur-[10px]">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div className="min-h-[20px]">
                      {errors._form && (
                        <p className="text-[13px] text-danger-red leading-[1.4]">
                          {errors._form}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        className="h-10 rounded-[6px] border border-border-input px-4 font-semibold text-[16px] text-text-secondary leading-none tracking-[-0.32px] transition-colors hover:bg-bg-hover"
                        onClick={handleCancel}
                        type="button"
                      >
                        Отмена
                      </button>
                      <button
                        className="h-10 rounded-[6px] bg-primary-blue-light px-4 font-semibold text-[16px] text-primary-blue leading-none tracking-[-0.32px] transition-colors hover:bg-primary-blue-light-hover"
                        onClick={handleContinueFromDescription}
                        type="button"
                      >
                        Продолжить
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : activeSectionId === "publications" ? (
              <CreateVacancyPublications
                onBack={() => goToStep("description")}
                onConfigChange={handlePublicationsConfigChange}
                onContinue={handleContinueFromPublications}
                prefillDescription={formData.descriptionHtml}
                prefillName={formData.name}
              />
            ) : (
              <div className="mt-6 flex flex-col gap-6">
                <h1 className="font-bold text-[44px] text-text-heading leading-none tracking-[-0.64px]">
                  Предпросмотр
                </h1>
                <div className="rounded-[6px] border border-border-input bg-bg-input px-4 py-6 text-[14px] text-text-secondary">
                  Предпросмотр публикации скоро будет доступен.
                </div>
                <div className="min-h-[20px]">
                  {errors._form && (
                    <p className="text-[13px] text-danger-red leading-[1.4]">
                      {errors._form}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-end gap-3 border-border-input border-t pt-4">
                  <button
                    className="h-10 rounded-[6px] border border-border-input px-4 font-semibold text-[16px] text-text-secondary leading-none tracking-[-0.32px] transition-colors hover:bg-bg-hover"
                    onClick={() => goToStep("publications")}
                    type="button"
                  >
                    Назад
                  </button>
                  <button
                    className="h-10 rounded-[6px] bg-primary-blue-light px-4 font-semibold text-[16px] text-primary-blue leading-none tracking-[-0.32px] transition-colors hover:bg-primary-blue-light-hover disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={createVacancy.isPending}
                    onClick={savedVacancyId ? reopenModal : handleSubmit}
                    type="button"
                  >
                    {createVacancy.isPending
                      ? "loading..."
                      : savedVacancyId
                        ? "Открыть публикации"
                        : "Сохранить вакансию"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      <Modal
        description="Опубликуйте вакансию в выбранных каналах."
        isOpen={modalOpen && savedVacancyId !== null}
        maxWidthClassName="max-w-[460px]"
        onClose={closeModal}
        title="Вакансия сохранена"
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {telegramSelected && telegramConfig?.enabled && (
              <button
                className="rounded-[8px] bg-primary-blue-dark px-5 py-2.5 font-medium text-[14px] text-bg-light transition-colors hover:bg-primary-blue-hover disabled:cursor-not-allowed disabled:opacity-60"
                disabled={postToTelegram.isPending || telegramStatus === "sent"}
                onClick={() => {
                  if (!savedVacancyId) {
                    return;
                  }

                  setTelegramStatus("sending");
                  postToTelegram.mutate({ vacancyId: savedVacancyId });
                }}
                type="button"
              >
                {telegramStatus === "sending"
                  ? "Отправка..."
                  : telegramStatus === "sent"
                    ? "Отправлено"
                    : "Telegram"}
              </button>
            )}
            {hhSelected && hhConfigQuery.data?.enabled && (
              <button
                className="rounded-[8px] bg-primary-blue-dark px-5 py-2.5 font-medium text-[14px] text-bg-light transition-colors hover:bg-primary-blue-hover disabled:cursor-not-allowed disabled:opacity-60"
                disabled={postToHh.isPending || hhStatus === "sent"}
                onClick={triggerHhPublish}
                type="button"
              >
                {hhStatus === "sending"
                  ? "Публикация..."
                  : hhStatus === "sent"
                    ? "Опубликовано"
                    : hhStatus === "error"
                      ? "Повторить hh.uz"
                      : "hh.uz"}
              </button>
            )}
            <button
              className="rounded-[8px] border border-border-input px-5 py-2.5 font-medium text-[14px] text-text-secondary transition-colors hover:bg-bg-hover"
              onClick={() => router.push("/vacancies")}
              type="button"
            >
              Перейти к вакансиям
            </button>
          </div>
          {telegramStatus === "error" && (
            <div className="rounded-[6px] border border-danger-red-bg bg-danger-red-bg px-3 py-2 text-[14px] text-danger-red">
              Не удалось отправить в Telegram. Попробуйте ещё раз.
            </div>
          )}
          {telegramStatus === "sent" && (
            <div className="rounded-[6px] border border-success-green-bg bg-success-green-bg px-3 py-2 text-[14px] text-success-green">
              Вакансия опубликована в Telegram-канал.
            </div>
          )}
          {hhStatus === "error" && (
            <div className="flex flex-col gap-2 rounded-[6px] border border-danger-red-bg bg-danger-red-bg px-3 py-2 text-[14px] text-danger-red">
              <span>{hhError ?? "Не удалось опубликовать на hh.uz."}</span>
              <button
                className="self-start rounded-[6px] border border-danger-red px-3 py-1 font-medium text-[13px] text-danger-red transition-colors hover:bg-bg-light"
                onClick={goEditHhFields}
                type="button"
              >
                Изменить параметры hh.uz
              </button>
            </div>
          )}
          {hhStatus === "sent" && publishedHhUrl && (
            <div className="rounded-[6px] border border-success-green-bg bg-success-green-bg px-3 py-2 text-[14px] text-success-green">
              Вакансия опубликована на hh.uz:{" "}
              <a
                className="underline"
                href={publishedHhUrl}
                rel="noreferrer"
                target="_blank"
              >
                открыть
              </a>
              .
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
