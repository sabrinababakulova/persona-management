"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Breadcrumbs } from "~/app/_components/Breadcrumbs";
import { ClosableSection } from "~/app/_components/closable-section";
import { Dropdown } from "~/app/_components/dropdown";
import { Input } from "~/app/_components/input";
import { RichTextEditor } from "~/app/_components/rich-text-editor";
import { SearchableSelect } from "~/app/_components/searchable-select";
import {
  type HhPublicationFields,
  useVacancyPublicationStore,
} from "~/stores/vacancy-publication-store";
import { api } from "~/trpc/react";
import { PublicationConfirmationModal } from "./publication-confirmation-modal";

/** Per-field error messages plus an optional `_form` entry for form-level errors. */
type HhErrors = Partial<Record<keyof HhPublicationFields | "_form", string>>;
type HhSubmitAction = "local" | "hhDraft" | "publish";

const HH_SUBMIT_ACTION_OPTIONS: { value: HhSubmitAction; label: string }[] = [
  { value: "local", label: "Сохранить в Persona" },
  { value: "hhDraft", label: "Сохранить черновик на hh.uz" },
  { value: "publish", label: "Опубликовать на hh.uz" },
];

const HH_SUBMIT_BUTTON_LABEL: Record<HhSubmitAction, string> = {
  local: "Сохранить",
  hhDraft: "Сохранить черновик",
  publish: "Опубликовать",
};

/** Returns true when the supplied HTML contains visible text (ignores empty tags like `<p></p>`). */
function hasMeaningfulHtml(html: string): boolean {
  return html.replace(/<[^>]*>/g, "").trim().length > 0;
}

/**
 * Removes duplicate options by `value`, keeping the first occurrence.
 *
 * hh.uz returns the same `professionalRoles` id under multiple category groups, which would
 * collide on the `<option key={value}>` we hand to Dropdown / SearchableSelect. Deduping by value
 * keeps the option list valid regardless of the source.
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
 * Per-channel publication editor for hh.uz. Lives at
 * `/vacancies/<id>/publications/hh.uz`.
 *
 * Reads / writes the hh.uz field draft from the shared Zustand store
 * (`vacancy-publication-store`) so values survive navigation. On first visit (or when the URL's
 * vacancy id changes) the store is hydrated from the server vacancy via `vacancies.get`.
 * Saving calls `vacancies.update`, refreshes the cache, and surfaces validation / API errors
 * inline.
 */
export function HhPublicationForm({
  vacancyId,
  pubId,
}: {
  vacancyId: string;
  pubId?: string;
}) {
  const router = useRouter();
  const utils = api.useUtils();
  const vacancyQuery = api.vacancies.get.useQuery({ id: pubId ?? vacancyId });
  const hhLookupsQuery = api.vacancies.getHhPublishLookups.useQuery();

  const fields = useVacancyPublicationStore((s) => s.hh);
  const setHhField = useVacancyPublicationStore((s) => s.setHhField);
  const setHhFields = useVacancyPublicationStore((s) => s.setHhFields);

  const [errors, setErrors] = useState<HhErrors>({});
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [submitAction, setSubmitAction] = useState<HhSubmitAction>("hhDraft");

  const [isPublishConfirmOpen, setIsPublishConfirmOpen] = useState(false);

  // Hydrate the store from server data once per vacancy/publication id. A
  // refetch — e.g. after a failed hh.uz save invalidates `vacancies.get` — must
  // NOT re-run hydration: that would clobber the user's filled-in fields with
  // the server row, which for a not-yet-saved publication is empty. We still
  // re-hydrate when the id changes (opening a different vacancy/publication).
  const hydratedForId = useRef<string | null>(null);
  useEffect(() => {
    const v = vacancyQuery.data;
    if (!v) {
      return;
    }
    const currentId = pubId ?? vacancyId;
    if (hydratedForId.current === currentId) {
      return;
    }
    hydratedForId.current = currentId;
    setHhFields({
      title: v.title ?? "",
      areaId: v.areaId ?? "",
      employmentId: v.employmentId ?? "",
      scheduleId: v.scheduleId ?? "",
      experienceId: v.experienceId ?? "",
      professionalRoleId: v.professionalRoleId ?? "",
      vacancyTypeId: v.vacancyTypeId ?? "open",
      billingTypeId: v.billingTypeId ?? "",
      descriptionHtml: v.descriptionHtml ?? "",
    });
  }, [vacancyQuery.data, pubId, vacancyId, setHhFields]);

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
  const vacancyTypeOptions = useMemo(
    () =>
      dedupeOptionsByValue(
        (hhLookupsQuery.data?.vacancyType ?? []).map((item) => ({
          value: item.id,
          label: item.name,
        })),
      ),
    [hhLookupsQuery.data?.vacancyType],
  );

  const createPublication = api.vacancies.create.useMutation({
    onSuccess: async () => {
      setErrors({});
      setSavedMessage("Публикация сохранены");
      await Promise.all([
        utils.vacancies.get.invalidate({ id: vacancyId }),
        utils.vacancies.list.invalidate(),
        utils.vacancies.listPublications.invalidate({
          parentVacancyId: vacancyId,
        }),
      ]);
      setIsPublishConfirmOpen(false);
    },
    onError: (error) => {
      setSavedMessage(null);
      setErrors({
        _form: error.message || "Не удалось сохранить изменения",
      });
    },
  });

  const updatePublication = api.vacancies.update.useMutation({
    onSuccess: async () => {
      setErrors({});
      setSavedMessage("Публикация обновлена");
      await Promise.all([
        pubId
          ? utils.vacancies.get.invalidate({ id: pubId })
          : Promise.resolve(),
        utils.vacancies.get.invalidate({ id: vacancyId }),
        utils.vacancies.listPublications.invalidate({
          parentVacancyId: vacancyId,
        }),
      ]);
      setIsPublishConfirmOpen(false);
    },
    onError: (error) => {
      setSavedMessage(null);
      setErrors({
        _form: error.message || "Не удалось обновить публикацию",
      });
    },
  });

  const publishToHH = api.vacancies.publishHh.useMutation({
    onSuccess: async () => {
      await utils.vacancies.get.invalidate({ id: vacancyId });
      await utils.vacancies.list.invalidate();
      await utils.vacancies.listPublications.invalidate({
        parentVacancyId: vacancyId,
      });
    },
    onError: (error) => {
      setErrors({
        _form: error.message || "Не удалось опубликовать на hh.uz",
      });
    },
  });
  const saveDraftToHH = api.vacancies.saveHhDraft.useMutation({
    onSuccess: async (result) => {
      setErrors({});
      const details = [
        result.publicationReady ? "готов к публикации" : "нужно дополнить",
        result.ignoredFields.length > 0
          ? `hh.uz не сохранил поля: ${result.ignoredFields.join(", ")}`
          : null,
        result.validationErrors.length > 0
          ? `есть замечания: ${result.validationErrors
              .map((item) => item.value)
              .join(", ")}`
          : null,
      ].filter((item): item is string => Boolean(item));
      setSavedMessage(
        `Черновик hh.uz сохранён: ${result.hhDraftId}${
          details.length > 0 ? ` (${details.join("; ")})` : ""
        }`,
      );
      await Promise.all([
        pubId
          ? utils.vacancies.get.invalidate({ id: pubId })
          : Promise.resolve(),
        utils.vacancies.get.invalidate({ id: vacancyId }),
        utils.vacancies.listPublications.invalidate({
          parentVacancyId: vacancyId,
        }),
      ]);
    },
    onError: (error) => {
      setSavedMessage(null);
      setErrors({
        _form: error.message || "Не удалось сохранить черновик на hh.uz",
      });
    },
  });

  const handleFieldChange = <K extends keyof HhPublicationFields>(
    key: K,
    value: HhPublicationFields[K],
  ) => {
    setHhField(key, value);
    if (savedMessage) {
      setSavedMessage(null);
    }
    setErrors((prev) => {
      if (!prev[key] && !prev._form) {
        return prev;
      }
      return { ...prev, [key]: undefined, _form: undefined };
    });
  };

  const validateDraft = (): boolean => {
    const next: HhErrors = {};
    const trimmedTitle = fields.title.trim();

    if (!trimmedTitle) {
      next.title = "Введите название публикации";
    } else if (trimmedTitle.length > 255) {
      next.title = "Название не должно быть длиннее 255 символов";
    }

    if (Object.keys(next).length > 0) {
      setErrors(next);
      return false;
    }
    setErrors({});
    return true;
  };

  const validate = (): boolean => {
    const next: HhErrors = {};

    if (!validateDraft()) {
      return false;
    }

    if (!fields.areaId) {
      next.areaId = "Выберите город";
    }
    if (!fields.professionalRoleId) {
      next.professionalRoleId = "Выберите профессиональную роль";
    }
    if (!fields.employmentId) {
      next.employmentId = "Выберите тип занятости";
    }
    if (!fields.scheduleId) {
      next.scheduleId = "Выберите график";
    }
    if (!fields.experienceId) {
      next.experienceId = "Выберите опыт";
    }
    if (!fields.billingTypeId) {
      next.billingTypeId = "Выберите тип публикации";
    }
    if (!fields.vacancyTypeId) {
      next.vacancyTypeId = "Выберите тип вакансии";
    }
    if (!hasMeaningfulHtml(fields.descriptionHtml)) {
      next.descriptionHtml = "Заполните описание вакансии";
    } else if (fields.descriptionHtml.length < 200) {
      next.descriptionHtml = "Описание должно быть не короче 200 символов";
    }

    if (Object.keys(next).length > 0) {
      setErrors(next);
      return false;
    }
    setErrors({});
    return true;
  };

  const ensureLocalPublication = async (isActivePub: boolean) => {
    const payload = {
      ...fields,
      title: fields.title.trim(),
      isActive: isActivePub,
      isPublication: true,
    };

    if (pubId) {
      await updatePublication.mutateAsync({
        id: pubId,
        ...payload,
      });
      return pubId;
    }

    const created = await createPublication.mutateAsync({
      parentId: vacancyId,
      ...payload,
      destination: "hh.uz",
    });

    return created.id;
  };

  const getSalaryPayload = () => {
    const salaryFrom = vacancyQuery.data?.salaryFrom;
    const salaryTo = vacancyQuery.data?.salaryTo;
    const hasSalary = salaryFrom !== undefined || salaryTo !== undefined;

    return {
      salaryCurrency: hasSalary
        ? (vacancyQuery.data?.salaryCurrency ?? "UZS")
        : undefined,
      salaryFrom,
      salaryTo,
    };
  };
  const getCurrentIsActive = () =>
    vacancyQuery.data && "isActive" in vacancyQuery.data
      ? vacancyQuery.data.isActive
      : false;

  const handleSave = async ({ isActivePub }: { isActivePub: boolean }) => {
    if (!validate() || !vacancyQuery.data) {
      return;
    }

    try {
      await ensureLocalPublication(isActivePub);
      router.push(`/vacancies/${vacancyId}?step=publications`);
    } catch {
      // Mutation handlers surface the error in the form.
    }
  };

  const handlePublish = async () => {
    if (!validate() || !vacancyQuery.data) {
      return;
    }

    try {
      const localVacancyId = await ensureLocalPublication(true);
      await publishToHH.mutateAsync({
        ...fields,
        name: fields.title.trim(),
        vacancyId: localVacancyId,
        ...getSalaryPayload(),
      });
      router.push(`/vacancies/${vacancyId}?step=publications`);
    } catch {
      // Mutation handlers surface the error in the form.
    }
  };

  const handleSaveHhDraft = async () => {
    if (!validateDraft() || !vacancyQuery.data) {
      return;
    }

    try {
      const localVacancyId = await ensureLocalPublication(getCurrentIsActive());
      await saveDraftToHH.mutateAsync({
        ...fields,
        name: fields.title.trim(),
        vacancyId: localVacancyId,
        descriptionHtml: fields.descriptionHtml || undefined,
        areaId: fields.areaId || undefined,
        employmentId: fields.employmentId || undefined,
        scheduleId: fields.scheduleId || undefined,
        experienceId: fields.experienceId || undefined,
        professionalRoleId: fields.professionalRoleId || undefined,
        vacancyTypeId: fields.vacancyTypeId || undefined,
        billingTypeId: fields.billingTypeId || undefined,
        ...getSalaryPayload(),
      });
      if (!pubId) {
        router.replace(
          `/vacancies/${vacancyId}/publications/hh.uz/${localVacancyId}`,
        );
      }
    } catch {
      // Mutation handlers surface the error in the form.
    }
  };

  const handleSubmitAction = () => {
    if (submitAction === "publish") {
      setIsPublishConfirmOpen(true);
      return;
    }

    if (submitAction === "hhDraft") {
      void handleSaveHhDraft();
      return;
    }

    void handleSave({ isActivePub: getCurrentIsActive() });
  };

  if (vacancyQuery.isLoading) {
    return (
      <main className="flex h-full flex-1 items-center justify-center text-text-placeholder">
        Загрузка вакансии...
      </main>
    );
  }

  if (!vacancyQuery.data) {
    return (
      <main className="flex h-full flex-1 items-center justify-center text-text-placeholder">
        Вакансия не найдена
      </main>
    );
  }

  return (
    <main className="relative w-full">
      <div className="flex w-full flex-col px-6 pt-8 pb-8">
        <div className="w-full max-w-[900px]">
          <Breadcrumbs
            label="Публикация на hh.uz"
            parent={{
              label: vacancyQuery.data.title || "Вакансия",
              href: `/vacancies/${vacancyId}`,
            }}
            rootHref="/vacancies"
            rootLabel="Вакансии"
          />

          <h1 className="mt-6 mb-6 font-bold text-[44px] text-text-heading leading-none tracking-[-0.64px]">
            Публикация на hh.uz
          </h1>

          {hhLookupsQuery.isError && (
            <div className="mb-4 rounded-[6px] border border-danger-red-bg bg-danger-red-bg px-3 py-2 text-[14px] text-danger-red">
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

          <div className="flex flex-col gap-8">
            <div
              className="scroll-mt-24 rounded-[8px] border border-border-input bg-bg-light p-4 lg:p-6"
              id="basic-information"
            >
              <ClosableSection title="Основная информация hh.uz">
                <div className="flex min-w-0 flex-col gap-2">
                  <Input
                    label="Название публикации"
                    maxLength={255}
                    onChange={(event) =>
                      setHhField("title", event.target.value)
                    }
                    placeholder="Введите название публикации"
                    value={fields.title}
                  />
                  {errors.title && (
                    <p className="text-[13px] text-danger-red leading-[1.4]">
                      {errors.title}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="flex min-w-0 flex-col gap-2">
                    <SearchableSelect
                      label="Город"
                      onChange={(value) => handleFieldChange("areaId", value)}
                      options={areaOptions}
                      placeholder="Выберите город"
                      searchPlaceholder="Найти город"
                      value={fields.areaId}
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
                      value={fields.professionalRoleId}
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
                      value={fields.employmentId}
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
                      value={fields.scheduleId}
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
                      value={fields.experienceId}
                    />
                    {errors.experienceId && (
                      <p className="text-[13px] text-danger-red leading-[1.4]">
                        {errors.experienceId}
                      </p>
                    )}
                  </div>

                  <div className="flex min-w-0 flex-col gap-2">
                    <Dropdown
                      label="Тип вакансии"
                      onChange={(value) =>
                        handleFieldChange("vacancyTypeId", value)
                      }
                      options={vacancyTypeOptions}
                      placeholder="Выберите тип вакансии"
                      value={fields.vacancyTypeId}
                    />
                    {errors.vacancyTypeId && (
                      <p className="text-[13px] text-danger-red leading-[1.4]">
                        {errors.vacancyTypeId}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="flex min-w-0 flex-col gap-2">
                    <Dropdown
                      label="Тип публикации"
                      onChange={(value) =>
                        handleFieldChange("billingTypeId", value)
                      }
                      options={billingTypeOptions}
                      placeholder="Выберите тип публикации"
                      value={fields.billingTypeId}
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
              className="scroll-mt-24 rounded-lg border border-border-input bg-bg-light p-4 lg:p-6"
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
                  value={fields.descriptionHtml}
                />
                {errors.descriptionHtml && (
                  <p className="text-[13px] text-danger-red leading-[1.4]">
                    {errors.descriptionHtml}
                  </p>
                )}
                <p className="text-[12px] text-text-secondary">
                  hh.uz принимает только базовое форматирование: абзацы, списки,
                  заголовки H3/H4, жирный, курсив и ссылки. Описание должно
                  содержать хотя бы один список.
                </p>
              </ClosableSection>
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
                {savedMessage && (
                  <p className="text-[13px] text-success-green leading-[1.4]">
                    {savedMessage}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <Dropdown
                  className="w-full min-w-[240px] sm:w-[260px]"
                  label="Действие"
                  onChange={(value) => setSubmitAction(value as HhSubmitAction)}
                  options={HH_SUBMIT_ACTION_OPTIONS}
                  value={submitAction}
                />
                <button
                  className="h-10 rounded-[6px] border border-border-input px-4 font-semibold text-[16px] text-text-secondary leading-none tracking-[-0.32px] transition-colors hover:bg-bg-hover"
                  onClick={() =>
                    router.push(`/vacancies/${vacancyId}?step=publications`)
                  }
                  type="button"
                >
                  Назад
                </button>
                <button
                  className="h-10 rounded-[6px] bg-primary-blue-light px-4 font-semibold text-[16px] text-primary-blue leading-none tracking-[-0.32px] transition-colors hover:bg-primary-blue-light-hover disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={
                    createPublication.isPending ||
                    updatePublication.isPending ||
                    saveDraftToHH.isPending ||
                    publishToHH.isPending
                  }
                  onClick={handleSubmitAction}
                  type="button"
                >
                  {createPublication.isPending ||
                  updatePublication.isPending ||
                  saveDraftToHH.isPending ||
                  publishToHH.isPending
                    ? "Сохранение..."
                    : HH_SUBMIT_BUTTON_LABEL[submitAction]}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <PublicationConfirmationModal
        confirmLabel="Опубликовать"
        description={
          "Публикация будет опубликована на hh.uz. Иначе текущая активная публикация будет в неактивном состоянии."
        }
        isOpen={isPublishConfirmOpen}
        isPending={
          createPublication.isPending ||
          updatePublication.isPending ||
          publishToHH.isPending
        }
        onClose={() => setIsPublishConfirmOpen(false)}
        onConfirm={() => void handlePublish()}
        onReject={() => setIsPublishConfirmOpen(false)}
        rejectLabel="Отмена"
        title={"Опубликовать публикацию?"}
      />
    </main>
  );
}
