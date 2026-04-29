"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Breadcrumbs } from "~/app/_components/Breadcrumbs";
import { ClosableSection } from "~/app/_components/closable-section";
import { Dropdown } from "~/app/_components/dropdown";
import { FormProgress } from "~/app/_components/form-progress";
import { Input } from "~/app/_components/input";
import { Modal } from "~/app/_components/modal";
import { SideMenu } from "~/app/_components/sideMenu";
import { Textarea } from "~/app/_components/textarea";
import { api } from "~/trpc/react";
import type { Vacancy } from "~/types/pages/vacancies-page";
import {
  formatNumberWithSpaces,
  parseFormattedNumber,
} from "~/utils/format-salaries";
import {
  CreateVacancyPublications,
  PUBLICATIONS_DRAFT_STORAGE_KEY,
} from "./create-vacancy-publications";

const DESCRIPTION_DRAFT_KEY = "vacancy-create:description-draft:v1";

const TIME_OPTIONS = Array.from({ length: 24 }, (_, hour) => {
  const label = `${String(hour).padStart(2, "0")}:00`;
  return { value: label, label };
});

const REQUIRED_FIELDS = [
  { key: "title", label: "Название вакансии" },
  { key: "level", label: "Уровень" },
  { key: "city", label: "Город" },
  { key: "workType", label: "Формат работы" },
  { key: "salaryExpectation", label: "Зарплата" },
  { key: "tasks", label: "Задачи" },
  { key: "team", label: "Команда" },
  { key: "companyDescription", label: "Описание компании" },
] as const;

const SIDE_MENU_ITEMS = [
  { id: "description", label: "Описание вакансии" },
  { id: "publications", label: "Публикации" },
  { id: "preview", label: "Предпросмотр" },
] as const;

type VacancyStatus = Vacancy["status"];
type SalaryCurrency = NonNullable<Vacancy["salaryCurrency"]>;

type VacancyCreateFormData = {
  title: string;
  level: string;
  status: VacancyStatus;
  city: string;
  responses: string;
  workType: string;
  salaryExpectation: string;
  salaryCurrency: SalaryCurrency;
  workScheduleStart: string;
  workScheduleEnd: string;
  comments: string;
  tasks: string;
  team: string;
  companyDescription: string;
};

type VacancyFormErrors = Partial<
  Record<keyof VacancyCreateFormData | "_form", string>
>;

function isVacancyStatus(value: string): value is VacancyStatus {
  return ["active", "draft", "paused", "closed", "archive"].includes(value);
}

function normalizeOptionalString(value: string) {
  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : undefined;
}

function parseResponses(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) {
    return 0;
  }

  return Number(digits);
}

export function CreateVacancyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const utils = api.useUtils();
  const stepParam = searchParams.get("step");
  const activeSectionId =
    stepParam && SIDE_MENU_ITEMS.some((item) => item.id === stepParam)
      ? stepParam
      : SIDE_MENU_ITEMS[0].id;
  const goToStep = (id: string) => {
    router.push(`/vacancies/create?step=${id}`);
  };
  const [savedVacancyId, setSavedVacancyId] = useState<string | null>(null);
  const [telegramStatus, setTelegramStatus] = useState<
    "idle" | "sending" | "sent" | "error"
  >("idle");
  const [errors, setErrors] = useState<VacancyFormErrors>({});
  const [hydrated, setHydrated] = useState(false);
  const [formData, setFormData] = useState<VacancyCreateFormData>({
    title: "",
    level: "",
    status: "draft",
    city: "",
    responses: "0",
    workType: "",
    salaryExpectation: "",
    salaryCurrency: "UZS",
    workScheduleStart: "09:00",
    workScheduleEnd: "18:00",
    comments: "",
    tasks: "",
    team: "",
    companyDescription: "",
  });

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DESCRIPTION_DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<VacancyCreateFormData>;
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
      window.localStorage.setItem(
        DESCRIPTION_DRAFT_KEY,
        JSON.stringify(formData),
      );
    } catch {
      // Ignore quota errors.
    }
  }, [formData, hydrated]);

  const clearDrafts = () => {
    try {
      window.localStorage.removeItem(DESCRIPTION_DRAFT_KEY);
      window.localStorage.removeItem(PUBLICATIONS_DRAFT_STORAGE_KEY);
    } catch {
      // Ignore.
    }
  };

  const {
    data: vacancyLookups,
    isError: isLookupsError,
    isLoading: isLookupsLoading,
    refetch: refetchLookups,
  } = api.lookups.getVacancyCreateOptions.useQuery();
  const { data: telegramConfig } = api.vacancies.getTelegramConfig.useQuery();

  useEffect(() => {
    if (!vacancyLookups) {
      return;
    }

    setFormData((previous) => {
      const nextStatus = vacancyLookups.statusOptions.some(
        (option) => option.value === previous.status,
      )
        ? previous.status
        : vacancyLookups.statusOptions[0]?.value;

      return {
        ...previous,
        status:
          nextStatus && isVacancyStatus(nextStatus) ? nextStatus : "draft",
      };
    });
  }, [vacancyLookups]);

  const progress = useMemo(() => {
    const missing = REQUIRED_FIELDS.filter(({ key }) => {
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

  const createVacancy = api.vacancies.create.useMutation({
    onSuccess: async (createdVacancy) => {
      await utils.vacancies.list.invalidate();
      clearDrafts();

      if (telegramConfig?.enabled) {
        setSavedVacancyId(createdVacancy.id);
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

  const handleFieldChange = <K extends keyof VacancyCreateFormData>(
    field: K,
    value: VacancyCreateFormData[K],
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

  const closeTelegramModal = () => {
    setSavedVacancyId(null);
    setTelegramStatus("idle");
  };

  const validateDescription = (): boolean => {
    const trimmedTitle = formData.title.trim();

    if (!trimmedTitle) {
      setErrors((previous) => ({
        ...previous,
        title: "Введите название вакансии",
      }));
      return false;
    }

    const parsedSalaryExpectation = parseFormattedNumber(
      formData.salaryExpectation,
    );
    if (
      parsedSalaryExpectation !== undefined &&
      parsedSalaryExpectation > 1_000_000_000
    ) {
      setErrors((previous) => ({
        ...previous,
        salaryExpectation: "Сумма не должна превышать 1 000 000 000",
      }));
      return false;
    }

    setErrors({});
    return true;
  };

  const handleContinueFromDescription = () => {
    if (!validateDescription()) {
      return;
    }
    goToStep("publications");
  };

  const handleContinueFromPublications = () => {
    goToStep("preview");
  };

  const handleCancel = () => {
    clearDrafts();
    router.push("/vacancies");
  };

  const handleSubmit = () => {
    if (!validateDescription()) {
      return;
    }

    const parsedSalaryExpectation = parseFormattedNumber(
      formData.salaryExpectation,
    );

    setTelegramStatus("idle");

    createVacancy.mutate({
      title: formData.title.trim(),
      level: normalizeOptionalString(formData.level),
      status: formData.status,
      city: normalizeOptionalString(formData.city),
      responses: parseResponses(formData.responses),
      workType: normalizeOptionalString(formData.workType),
      salaryExpectation: parsedSalaryExpectation,
      salaryCurrency: formData.salaryCurrency,
      workScheduleStart: normalizeOptionalString(formData.workScheduleStart),
      workScheduleEnd: normalizeOptionalString(formData.workScheduleEnd),
      comments: normalizeOptionalString(formData.comments),
      tasks: normalizeOptionalString(formData.tasks),
      team: normalizeOptionalString(formData.team),
      companyDescription: normalizeOptionalString(formData.companyDescription),
    });
  };

  if (isLookupsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-light">
        <div className="text-text-secondary">Загрузка справочников...</div>
      </div>
    );
  }

  if (isLookupsError || !vacancyLookups) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-light px-4">
        <div className="w-full max-w-[460px] rounded-[8px] border border-danger-red-bg bg-danger-red-bg p-5 text-danger-red">
          <p className="mb-4 text-[14px]">
            Не удалось загрузить справочники из базы данных.
          </p>
          <button
            className="rounded-[6px] bg-primary-blue px-4 py-2 text-[14px] text-bg-light hover:bg-primary-blue-hover"
            onClick={() => void refetchLookups()}
            type="button"
          >
            Повторить
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full">
      <div className="flex w-full gap-[64px] px-6 pt-8 pb-8">
        <SideMenu
          activeId={activeSectionId}
          items={SIDE_MENU_ITEMS.map((item) => ({
            ...item,
            disabled: item.id !== "description",
          }))}
          onSelect={goToStep}
        />

        <section className="flex flex-3 flex-col">
          <div className="w-full max-w-[560px]">
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
                  <div className="w-full sm:w-[180px]">
                    <Dropdown
                      fieldClassName="h-8 px-2 py-2 pr-6 text-[14px] leading-none tracking-[-0.28px]"
                      hideLabel
                      iconClassName="right-2 h-4 w-4 text-text-placeholder"
                      label="Статус"
                      onChange={(value) => {
                        if (isVacancyStatus(value)) {
                          handleFieldChange("status", value);
                        }
                      }}
                      options={vacancyLookups.statusOptions}
                      value={formData.status}
                    />
                  </div>
                </div>

                <FormProgress
                  filled={progress.filled}
                  missing={progress.missing}
                  percentage={progress.percentage}
                  total={progress.total}
                />

                <div className="flex flex-col gap-8 lg:flex-row lg:gap-16">
                  <div className="min-w-0 flex-1 space-y-8">
                    <div
                      className="scroll-mt-24 rounded-[8px] border border-border-input bg-bg-light p-4 lg:p-6"
                      id="basic-information"
                    >
                      <ClosableSection title="Основная информация">
                        <Input
                          label="Название вакансии"
                          maxLength={255}
                          onChange={(event) =>
                            handleFieldChange("title", event.target.value)
                          }
                          placeholder="Например, Frontend Developer"
                          value={formData.title}
                        />
                        {errors.title && (
                          <p className="text-[13px] text-danger-red leading-[1.4]">
                            {errors.title}
                          </p>
                        )}

                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                          <Dropdown
                            label="Уровень"
                            onChange={(value) =>
                              handleFieldChange("level", value)
                            }
                            options={vacancyLookups.levels}
                            placeholder="Выберите уровень"
                            value={formData.level}
                          />
                          {vacancyLookups.cities.length > 0 ? (
                            <Dropdown
                              label="Город"
                              onChange={(value) =>
                                handleFieldChange("city", value)
                              }
                              options={vacancyLookups.cities}
                              placeholder="Выберите город"
                              value={formData.city}
                            />
                          ) : (
                            <Input
                              label="Город"
                              maxLength={255}
                              onChange={(event) =>
                                handleFieldChange("city", event.target.value)
                              }
                              placeholder="Введите город"
                              value={formData.city}
                            />
                          )}
                        </div>

                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                          <Dropdown
                            label="Формат работы"
                            onChange={(value) =>
                              handleFieldChange("workType", value)
                            }
                            options={vacancyLookups.workTypes}
                            placeholder="Выберите формат работы"
                            value={formData.workType}
                          />
                          <Input
                            inputMode="numeric"
                            label="Количество откликов"
                            maxLength={9}
                            onChange={(event) =>
                              handleFieldChange(
                                "responses",
                                event.target.value.replace(/\D/g, ""),
                              )
                            }
                            placeholder="0"
                            value={formData.responses}
                          />
                        </div>
                      </ClosableSection>
                    </div>

                    <div
                      className="scroll-mt-24 rounded-[8px] border border-border-input bg-bg-light p-4 lg:p-6"
                      id="conditions"
                    >
                      <ClosableSection title="Условия">
                        <Input
                          endAdornment={
                            <div className="flex overflow-hidden rounded-md border border-border-input">
                              <button
                                aria-pressed={formData.salaryCurrency === "UZS"}
                                className={`px-2 py-1.5 font-semibold text-[12px] tracking-[-0.24px] ${
                                  formData.salaryCurrency === "UZS"
                                    ? "bg-primary-blue-light text-primary-blue"
                                    : "bg-bg-light text-text-disabled"
                                }`}
                                onClick={() =>
                                  handleFieldChange("salaryCurrency", "UZS")
                                }
                                type="button"
                              >
                                UZS
                              </button>
                              <button
                                aria-pressed={formData.salaryCurrency === "USD"}
                                className={`px-2 py-1.5 font-semibold text-[12px] tracking-[-0.24px] ${
                                  formData.salaryCurrency === "USD"
                                    ? "bg-primary-blue-light text-primary-blue"
                                    : "bg-bg-light text-text-disabled"
                                }`}
                                onClick={() =>
                                  handleFieldChange("salaryCurrency", "USD")
                                }
                                type="button"
                              >
                                USD
                              </button>
                            </div>
                          }
                          id="salaryExpectation"
                          inputMode="numeric"
                          label="Зарплата"
                          maxLength={20}
                          onChange={(event) =>
                            handleFieldChange(
                              "salaryExpectation",
                              formatNumberWithSpaces(event.target.value),
                            )
                          }
                          placeholder="Введите сумму"
                          type="text"
                          value={formData.salaryExpectation}
                        />
                        {errors.salaryExpectation && (
                          <p className="text-[13px] text-danger-red leading-[1.4]">
                            {errors.salaryExpectation}
                          </p>
                        )}

                        <div className="space-y-2">
                          <p className="font-medium text-[16px] text-text-label leading-[1.4] tracking-[-0.32px]">
                            График работы
                          </p>
                          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <Dropdown
                              hideLabel
                              label="Время начала"
                              onChange={(value) =>
                                handleFieldChange("workScheduleStart", value)
                              }
                              options={TIME_OPTIONS}
                              value={formData.workScheduleStart}
                            />
                            <Dropdown
                              hideLabel
                              label="Время окончания"
                              onChange={(value) =>
                                handleFieldChange("workScheduleEnd", value)
                              }
                              options={TIME_OPTIONS}
                              value={formData.workScheduleEnd}
                            />
                          </div>
                        </div>

                        <Textarea
                          id="vacancy-comments"
                          label="Комментарии"
                          maxLength={4000}
                          onChange={(event) =>
                            handleFieldChange("comments", event.target.value)
                          }
                          placeholder="Например, гибкий график, бонусы, испытательный срок"
                          value={formData.comments}
                        />
                      </ClosableSection>
                    </div>

                    <div
                      className="scroll-mt-24 rounded-[8px] border border-border-input bg-bg-light p-4 lg:p-6"
                      id="description"
                    >
                      <ClosableSection title="Описание">
                        <Textarea
                          className="min-h-[160px]"
                          id="vacancy-tasks"
                          label="Задачи"
                          maxLength={4000}
                          onChange={(event) =>
                            handleFieldChange("tasks", event.target.value)
                          }
                          placeholder="Опишите ключевые задачи, зоны ответственности и ожидаемый результат"
                          value={formData.tasks}
                        />
                        <Textarea
                          className="min-h-[120px]"
                          id="vacancy-team"
                          label="Команда"
                          maxLength={4000}
                          onChange={(event) =>
                            handleFieldChange("team", event.target.value)
                          }
                          placeholder="Кто будет рядом с новым сотрудником: руководитель, команда, смежные роли"
                          value={formData.team}
                        />
                        <Textarea
                          className="min-h-[160px]"
                          id="vacancy-company-description"
                          label="Описание компании"
                          maxLength={8000}
                          onChange={(event) =>
                            handleFieldChange(
                              "companyDescription",
                              event.target.value,
                            )
                          }
                          placeholder="Кратко расскажите о компании, продукте и ценности вакансии"
                          value={formData.companyDescription}
                        />
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
                onCancel={handleCancel}
                onContinue={handleContinueFromPublications}
                prefillDescription={formData.tasks}
                prefillName={formData.title}
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
                    onClick={handleCancel}
                    type="button"
                  >
                    Отмена
                  </button>
                  <button
                    className="h-10 rounded-[6px] bg-primary-blue-light px-4 font-semibold text-[16px] text-primary-blue leading-none tracking-[-0.32px] transition-colors hover:bg-primary-blue-light-hover disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={createVacancy.isPending}
                    onClick={handleSubmit}
                    type="button"
                  >
                    {createVacancy.isPending
                      ? "loading..."
                      : "Сохранить вакансию"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      <Modal
        description="Опубликовать вакансию в Telegram-канал?"
        isOpen={savedVacancyId !== null}
        maxWidthClassName="max-w-[460px]"
        onClose={closeTelegramModal}
        title="Вакансия сохранена"
      >
        <div className="flex flex-wrap items-center gap-3">
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
      </Modal>
    </div>
  );
}
