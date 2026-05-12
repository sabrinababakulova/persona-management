"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Breadcrumbs } from "~/app/_components/Breadcrumbs";
import { ClosableSection } from "~/app/_components/closable-section";
import { Dropdown } from "~/app/_components/dropdown";
import { FormProgress } from "~/app/_components/form-progress";
import { Input } from "~/app/_components/input";
import { RichTextEditor } from "~/app/_components/rich-text-editor";
import { api } from "~/trpc/react";
import {
  formatNumberWithSpaces,
  parseFormattedNumber,
} from "~/utils/format-salaries";

const CURRENCY_OPTIONS = [
  { value: "UZS", label: "UZS" },
  { value: "USD", label: "USD" },
];

type BasicVacancyFormData = {
  title: string;
  descriptionHtml: string;
  salaryFrom: string;
  salaryTo: string;
  salaryCurrency: string;
  contactPhone: string;
};

type BasicVacancyFormErrors = Partial<
  Record<keyof BasicVacancyFormData | "_form", string>
>;

const REQUIRED_FIELDS: ReadonlyArray<{
  key: keyof BasicVacancyFormData;
  label: string;
}> = [{ key: "title", label: "Название вакансии" }];

export type CreateVacancyFormInitialData = Partial<BasicVacancyFormData> & {
  name?: string;
};

export type CreateVacancyFormProps = {
  vacancyId?: string;
  initialData?: CreateVacancyFormInitialData;
  breadcrumbLabel?: string;
  pageHeading?: string;
  bannerContent?: ReactNode;
  readOnly?: boolean;
  onSaved?: (vacancyId: string) => void;
};

function normalizeInitialData(
  initialData?: CreateVacancyFormInitialData,
): BasicVacancyFormData {
  return {
    title: initialData?.title ?? initialData?.name ?? "",
    descriptionHtml: initialData?.descriptionHtml ?? "",
    salaryFrom: initialData?.salaryFrom ?? "",
    salaryTo: initialData?.salaryTo ?? "",
    salaryCurrency: initialData?.salaryCurrency ?? "UZS",
    contactPhone: initialData?.contactPhone ?? "",
  };
}

function getSalaryCurrency(value: string): "UZS" | "USD" {
  return value === "USD" ? "USD" : "UZS";
}

export function CreateVacancyForm({
  vacancyId,
  initialData,
  breadcrumbLabel = "Добавление вакансии",
  pageHeading = "Добавление вакансии",
  bannerContent,
  readOnly = false,
  onSaved,
}: CreateVacancyFormProps = {}) {
  const router = useRouter();
  const utils = api.useUtils();
  const isEditMode = Boolean(vacancyId);

  const [formData, setFormData] = useState<BasicVacancyFormData>(() =>
    normalizeInitialData(initialData),
  );
  const [errors, setErrors] = useState<BasicVacancyFormErrors>({});
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isEditMode) {
      return;
    }
    setFormData(normalizeInitialData(initialData));
  }, [initialData, isEditMode]);

  const progress = useMemo(() => {
    const missing = REQUIRED_FIELDS.filter(
      ({ key }) => formData[key].trim() === "",
    ).map(({ label }) => label);

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
      setErrors({});
      await utils.vacancies.list.invalidate();

      if (onSaved) {
        onSaved(createdVacancy.id);
        return;
      }

      router.push(`/vacancies/${createdVacancy.id}?step=publications`);
    },
    onError: (error) => {
      setErrors((previous) => ({
        ...previous,
        _form: error.message || "Не удалось сохранить вакансию",
      }));
    },
  });

  const updateVacancy = api.vacancies.update.useMutation({
    onSuccess: async () => {
      setErrors({});
      setUpdateMessage("Изменения сохранены");
      if (vacancyId) {
        await Promise.all([
          utils.vacancies.get.invalidate({ id: vacancyId }),
          utils.vacancies.list.invalidate(),
        ]);
      }
    },
    onError: (error) => {
      setUpdateMessage(null);
      setErrors((previous) => ({
        ...previous,
        _form: error.message || "Не удалось сохранить изменения",
      }));
    },
  });

  const handleFieldChange = <K extends keyof BasicVacancyFormData>(
    field: K,
    value: BasicVacancyFormData[K],
  ) => {
    setFormData((current) => ({ ...current, [field]: value }));
    setUpdateMessage(null);
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

  const validateForm = (): boolean => {
    const nextErrors: BasicVacancyFormErrors = {};

    if (!formData.title.trim()) {
      nextErrors.title = "Введите название вакансии";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return false;
    }

    setErrors({});
    return true;
  };

  const buildPayload = () => {
    const salaryFrom = formData.salaryFrom
      ? parseFormattedNumber(formData.salaryFrom)
      : undefined;
    const salaryTo = formData.salaryTo
      ? parseFormattedNumber(formData.salaryTo)
      : undefined;

    return {
      title: formData.title.trim(),
      salaryFrom,
      salaryTo,
      salaryCurrency: getSalaryCurrency(formData.salaryCurrency),
      descriptionHtml: formData.descriptionHtml || undefined,
      contactPhone: formData.contactPhone || undefined,
    };
  };

  const handleSubmit = () => {
    if (readOnly || !validateForm()) {
      return;
    }

    const payload = buildPayload();

    if (vacancyId) {
      updateVacancy.mutate({
        id: vacancyId,
        ...payload,
        salaryFrom: payload.salaryFrom ?? null,
        salaryTo: payload.salaryTo ?? null,
        descriptionHtml: payload.descriptionHtml ?? null,
        contactPhone: payload.contactPhone ?? null,
      });
      return;
    }

    createVacancy.mutate({
      ...payload,
      status: "draft",
    });
  };

  const handleCancel = () => {
    router.push("/vacancies");
  };

  const isSaving = createVacancy.isPending || updateVacancy.isPending;

  return (
    <div className="w-full max-w-[900px]">
      <Breadcrumbs
        label={breadcrumbLabel}
        rootHref="/vacancies"
        rootLabel="Вакансии"
      />

      <div className="mt-6 mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-bold text-[44px] text-text-heading leading-none tracking-[-0.64px]">
          {pageHeading}
        </h1>
      </div>

      {bannerContent && <div className="mb-6">{bannerContent}</div>}

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
              <div className="flex min-w-0 flex-col gap-2">
                <Input
                  disabled={readOnly}
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
                <RichTextEditor
                  disabled={readOnly}
                  id="description-html"
                  label="Описание вакансии"
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
                  disabled={readOnly}
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
                  disabled={readOnly}
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
                  disabled={readOnly}
                  label="Валюта"
                  onChange={(value) =>
                    handleFieldChange("salaryCurrency", value)
                  }
                  options={CURRENCY_OPTIONS}
                  value={formData.salaryCurrency || "UZS"}
                />
              </div>

              <Input
                disabled={readOnly}
                label="Контактный телефон"
                onChange={(event) =>
                  handleFieldChange("contactPhone", event.target.value)
                }
                placeholder="99 999 99 99"
                value={formData.contactPhone}
              />
            </ClosableSection>
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 z-10 mt-8 border-border-input border-t bg-bg-light py-4 backdrop-blur-[10px]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-h-[20px] flex-col gap-1">
            {errors._form && (
              <p className="text-[13px] text-danger-red leading-[1.4]">
                {errors._form}
              </p>
            )}
            {isEditMode && updateMessage && (
              <p className="text-[13px] text-success-green leading-[1.4]">
                {updateMessage}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              className="h-10 rounded-[6px] border border-border-input px-4 font-semibold text-[16px] text-text-secondary leading-none tracking-[-0.32px] transition-colors hover:bg-bg-hover"
              onClick={handleCancel}
              type="button"
            >
              {readOnly ? "Назад" : "Отмена"}
            </button>
            {!readOnly && (
              <button
                className="h-10 rounded-[6px] bg-primary-blue-light px-4 font-semibold text-[16px] text-primary-blue leading-none tracking-[-0.32px] transition-colors hover:bg-primary-blue-light-hover disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSaving}
                onClick={handleSubmit}
                type="button"
              >
                {isSaving
                  ? "Сохранение..."
                  : isEditMode
                    ? "Сохранить изменения"
                    : "Продолжить"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
