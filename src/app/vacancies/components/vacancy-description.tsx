"use client";

import { useEffect, useMemo, useState } from "react";
import { ClosableSection } from "~/app/_components/closable-section";
import { Dropdown } from "~/app/_components/dropdown";
import { Input } from "~/app/_components/input";
import { Textarea } from "~/app/_components/textarea";
import { api } from "~/trpc/react";
import type { SelectOption } from "~/types/candidates/components";
import type { Vacancy } from "~/types/pages/vacancies-page";
import type { VacancyLookups } from "~/types/shared/vacancy-lookups";
import {
  formatNumberWithSpaces,
  parseFormattedNumber,
} from "~/utils/format-salaries";

type VacancyFormState = {
  title: string;
  level: string;
  city: string;
  workType: string;
  status: Vacancy["status"];
  salaryExpectation?: number;
  salaryCurrency: "UZS" | "USD";
  workScheduleStart: string;
  workScheduleEnd: string;
  comments: string;
  tasks: string;
  team: string;
  companyDescription: string;
};

type VacancyDescriptionProps = {
  title: string;
  level: string;
  city: string;
  workType: string;
  salaryExpectation?: number;
  salaryCurrency?: "UZS" | "USD";
  workScheduleStart?: string;
  workScheduleEnd?: string;
  comments?: string;
  tasks: string;
  team: string;
  companyDescription: string;
  status: Vacancy["status"];
  vacancyId: string;
  vacancyLookups: VacancyLookups;
};

function isVacancyStatus(value: string): value is Vacancy["status"] {
  return ["active", "draft", "paused", "closed", "archive"].includes(value);
}

function mapWorkTypeValue(
  rawWorkType: string,
  options: SelectOption[],
): string {
  if (!rawWorkType.trim()) {
    return "";
  }

  const exactValueMatch = options.find(
    (option) => option.value === rawWorkType,
  );
  if (exactValueMatch) {
    return exactValueMatch.value;
  }

  const labelMatch = options.find((option) => option.label === rawWorkType);
  if (labelMatch) {
    return labelMatch.value;
  }

  return rawWorkType;
}

const TIME_OPTIONS: SelectOption[] = Array.from({ length: 24 }, (_, hour) => {
  const hourLabel = String(hour).padStart(2, "0");
  return { value: `${hourLabel}:00`, label: `${hourLabel}:00` };
});

const DEFAULT_DETAILS_VALUES = {
  salaryExpectation: undefined as number | undefined,
  salaryCurrency: "UZS" as const,
  workScheduleStart: "09:00",
  workScheduleEnd: "18:00",
  comments: "",
};

export function VacancyDescription({
  title,
  level,
  city,
  workType,
  salaryExpectation,
  salaryCurrency,
  workScheduleStart,
  workScheduleEnd,
  comments,
  tasks,
  team,
  companyDescription,
  status,
  vacancyId,
  vacancyLookups,
}: VacancyDescriptionProps) {
  const utils = api.useUtils();
  const [formState, setFormState] = useState<VacancyFormState>({
    title,
    level,
    city,
    workType: mapWorkTypeValue(workType, vacancyLookups.workTypes),
    status,
    ...DEFAULT_DETAILS_VALUES,
    salaryExpectation: salaryExpectation ?? undefined,
    salaryCurrency: salaryCurrency ?? "UZS",
    workScheduleStart:
      workScheduleStart || DEFAULT_DETAILS_VALUES.workScheduleStart,
    workScheduleEnd: workScheduleEnd || DEFAULT_DETAILS_VALUES.workScheduleEnd,
    comments: comments ?? "",
    tasks,
    team,
    companyDescription,
  });
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setFormState((prev) => ({
      ...prev,
      title,
      level,
      city,
      workType: mapWorkTypeValue(workType, vacancyLookups.workTypes),
      status,
      salaryExpectation: salaryExpectation ?? undefined,
      salaryCurrency: salaryCurrency ?? "UZS",
      workScheduleStart:
        workScheduleStart || DEFAULT_DETAILS_VALUES.workScheduleStart,
      workScheduleEnd:
        workScheduleEnd || DEFAULT_DETAILS_VALUES.workScheduleEnd,
      comments: comments ?? "",
      tasks,
      team,
      companyDescription,
    }));
  }, [
    title,
    level,
    city,
    workType,
    salaryExpectation,
    salaryCurrency,
    workScheduleStart,
    workScheduleEnd,
    comments,
    tasks,
    team,
    companyDescription,
    status,
    vacancyLookups.workTypes,
  ]);

  const updateVacancy = api.vacancies.updateVacancy.useMutation({
    onSuccess: async () => {
      setFormError(null);
      setFormMessage("Изменения сохранены");
      await Promise.all([
        utils.vacancies.getVacancyById.invalidate({ id: vacancyId }),
        utils.vacancies.getAllVacancies.invalidate(),
      ]);
    },
    onError: (error) => {
      setFormMessage(null);
      setFormError(error.message || "Не удалось сохранить изменения");
    },
  });

  const workTypeOptions = useMemo(() => {
    if (!formState.workType) {
      return vacancyLookups.workTypes;
    }

    const hasSelectedValue = vacancyLookups.workTypes.some(
      (option) => option.value === formState.workType,
    );
    if (hasSelectedValue) {
      return vacancyLookups.workTypes;
    }

    return [
      ...vacancyLookups.workTypes,
      { value: formState.workType, label: formState.workType },
    ];
  }, [formState.workType, vacancyLookups.workTypes]);

  const cityOptions = useMemo(() => {
    if (!formState.city.trim()) {
      return [{ value: "", label: "Город не указан" }];
    }

    return [{ value: formState.city, label: formState.city }];
  }, [formState.city]);

  const handleInputChange = <K extends keyof VacancyFormState>(
    field: K,
    value: VacancyFormState[K],
  ) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
    setFormMessage(null);
    setFormError(null);
  };

  const handleSalaryExpectationChange = (value: string) => {
    handleInputChange("salaryExpectation", parseFormattedNumber(value));
  };

  const handleCityChange = (_value: string) => {
    // City dropdown options will be wired in a dedicated task.
  };

  const handleStatusChange = (value: string) => {
    if (!isVacancyStatus(value) || value === formState.status) {
      return;
    }

    const previousStatus = formState.status;
    handleInputChange("status", value);
    updateVacancy.mutate(
      { id: vacancyId, status: value },
      {
        onError: () => {
          setFormState((prev) => ({ ...prev, status: previousStatus }));
        },
      },
    );
  };

  const handleSave = () => {
    const trimmedTitle = formState.title.trim();
    if (!trimmedTitle) {
      setFormMessage(null);
      setFormError("Введите должность");
      return;
    }

    updateVacancy.mutate({
      id: vacancyId,
      title: trimmedTitle,
      level: formState.level.trim(),
      city: formState.city.trim(),
      workType: formState.workType.trim(),
      salaryExpectation: formState.salaryExpectation ?? null,
      salaryCurrency: formState.salaryCurrency,
      workScheduleStart: formState.workScheduleStart.trim(),
      workScheduleEnd: formState.workScheduleEnd.trim(),
      comments: formState.comments.trim(),
      tasks: formState.tasks.trim(),
      team: formState.team.trim(),
      companyDescription: formState.companyDescription.trim(),
      status: formState.status,
    });
  };

  return (
    <>
      <div className="w-full bg-white pt-8 pb-6">
        <div className="flex w-full items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col items-start justify-center gap-2.5">
            <p className="truncate font-bold text-[32px] text-text-heading leading-none tracking-[-0.64px]">
              {formState.title.trim() || "Название вакансии"}
            </p>
            <div className="flex items-center gap-2">
              <p className="font-medium text-[20px] text-text-secondary leading-none tracking-[-0.4px]">
                {formState.level.trim() || "Уровень"}
              </p>
              <span
                aria-hidden="true"
                className="h-[14px] w-px bg-border-input"
              />
              <p className="font-medium text-[20px] text-text-secondary leading-none tracking-[-0.4px]">
                {formState.city.trim() || "Город"}
              </p>
            </div>
          </div>

          <div className="w-[140px] shrink-0">
            <Dropdown
              fieldClassName="h-8 px-2 py-2 pr-6 text-[14px] leading-none tracking-[-0.28px]"
              hideLabel
              iconClassName="right-2 h-4 w-4 text-text-placeholder"
              label="Статус"
              onChange={handleStatusChange}
              options={vacancyLookups.statusOptions}
              value={formState.status}
            />
          </div>
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-10 space-y-6">
        <ClosableSection title="Основная информация">
          <Input
            label="Должность"
            onChange={(event) => handleInputChange("title", event.target.value)}
            value={formState.title}
          />
          <Input
            label="Отдел"
            onChange={(event) => handleInputChange("level", event.target.value)}
            value={formState.level}
          />
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Dropdown
              label="Город"
              onChange={handleCityChange}
              options={cityOptions}
              value={formState.city}
            />
            <Dropdown
              label="Формат работы"
              onChange={(value) => handleInputChange("workType", value)}
              options={workTypeOptions}
              placeholder="Выберите формат работы"
              value={formState.workType}
            />
          </div>
        </ClosableSection>

        <ClosableSection title="Условия">
          <Input
            endAdornment={
              <div className="flex overflow-hidden rounded-md border border-border-input">
                <button
                  aria-pressed={formState.salaryCurrency === "UZS"}
                  className={`px-2 py-1.5 font-semibold text-[12px] tracking-[-0.24px] ${
                    formState.salaryCurrency === "UZS"
                      ? "bg-primary-blue-light text-primary-blue"
                      : "bg-white text-text-disabled"
                  }`}
                  onClick={() => handleInputChange("salaryCurrency", "UZS")}
                  type="button"
                >
                  UZS
                </button>
                <button
                  aria-pressed={formState.salaryCurrency === "USD"}
                  className={`px-2 py-1.5 font-semibold text-[12px] tracking-[-0.24px] ${
                    formState.salaryCurrency === "USD"
                      ? "bg-primary-blue-light text-primary-blue"
                      : "bg-white text-text-disabled"
                  }`}
                  onClick={() => handleInputChange("salaryCurrency", "USD")}
                  type="button"
                >
                  USD
                </button>
              </div>
            }
            id="salaryExpectation"
            inputMode="numeric"
            label="Зарплата"
            onChange={(event) =>
              handleSalaryExpectationChange(event.target.value)
            }
            placeholder="Введите сумму"
            type="text"
            value={
              formState.salaryExpectation !== undefined
                ? formatNumberWithSpaces(formState.salaryExpectation)
                : ""
            }
          />

          <div className="space-y-2">
            <p className="font-medium text-[16px] text-text-label leading-[1.4] tracking-[-0.32px]">
              График работы
            </p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Dropdown
                hideLabel
                label="Время начала"
                onChange={(value) =>
                  handleInputChange("workScheduleStart", value)
                }
                options={TIME_OPTIONS}
                value={formState.workScheduleStart}
              />
              <Dropdown
                hideLabel
                label="Время окончания"
                onChange={(value) =>
                  handleInputChange("workScheduleEnd", value)
                }
                options={TIME_OPTIONS}
                value={formState.workScheduleEnd}
              />
            </div>
          </div>

          <Textarea
            id="vacancy-comments"
            label="Комментарии"
            onChange={(event) =>
              handleInputChange("comments", event.target.value)
            }
            placeholder="Опыт работы приветствуется"
            value={formState.comments}
          />
        </ClosableSection>

        <ClosableSection title="Описание">
          <Input
            label="Задачи"
            onChange={(event) => handleInputChange("tasks", event.target.value)}
            value={formState.tasks}
          />
          <Input
            label="Команда"
            onChange={(event) => handleInputChange("team", event.target.value)}
            value={formState.team}
          />
          <Textarea
            id="vacancy-company-description"
            label="Описание компании"
            onChange={(event) =>
              handleInputChange("companyDescription", event.target.value)
            }
            value={formState.companyDescription}
          />
        </ClosableSection>
      </div>

      <div className="sticky bottom-0 z-10 mt-8 border-border-input border-t bg-[rgba(255,255,255,0.9)] py-4 backdrop-blur-[10px]">
        <div className="flex w-full max-w-[560px] justify-end">
          <div className="flex flex-col items-end gap-2">
            {formError && (
              <p className="text-[13px] text-danger-red leading-[1.4]">
                {formError}
              </p>
            )}
            {formMessage && (
              <p className="text-[13px] text-success-green leading-[1.4]">
                {formMessage}
              </p>
            )}
            <button
              className="h-10 rounded-[6px] bg-primary-blue-light px-4 font-semibold text-[16px] text-primary-blue leading-none tracking-[-0.32px] transition-colors hover:bg-primary-blue-light-hover disabled:cursor-not-allowed disabled:opacity-60"
              disabled={updateVacancy.isPending}
              onClick={handleSave}
              type="button"
            >
              {updateVacancy.isPending
                ? "Сохранение..."
                : "Сохранить изменения"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
