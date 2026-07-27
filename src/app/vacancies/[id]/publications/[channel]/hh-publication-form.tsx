"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { Breadcrumbs } from "~/app/_components/Breadcrumbs";
import { ClosableSection } from "~/app/_components/closable-section";
import { Dropdown } from "~/app/_components/dropdown";
import { Input } from "~/app/_components/input";
import {
  FeedbackPresence,
  LoadingButtonContent,
  LoadingState,
} from "~/app/_components/motion-system";
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
  const t = useTranslations("Publications");
  const commonT = useTranslations("Common");
  const navigationT = useTranslations("Navigation");
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
  const submitActionOptions: { value: HhSubmitAction; label: string }[] = [
    { value: "local", label: t("hh.savePersona") },
    { value: "hhDraft", label: t("hh.saveDraft") },
    { value: "publish", label: t("hh.publish") },
  ];
  const submitButtonLabels: Record<HhSubmitAction, string> = {
    local: t("hh.save"),
    hhDraft: t("hh.saveDraftButton"),
    publish: t("publish"),
  };

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
      setSavedMessage(t("saved"));
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
        _form: error.message || t("hh.saveError"),
      });
    },
  });

  const updatePublication = api.vacancies.update.useMutation({
    onSuccess: async () => {
      setErrors({});
      setSavedMessage(t("updated"));
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
        _form: error.message || t("hh.updateError"),
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
      setSavedMessage(null);
      setErrors({
        _form: error.message || t("hh.publishError"),
      });
    },
  });

  // Used to roll back a publication that was created only so hh.uz had a
  // vacancy id to attach to, when hh.uz then rejects it.
  const deletePublication = api.vacancies.deletePublication.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.vacancies.list.invalidate(),
        utils.vacancies.listPublications.invalidate({
          parentVacancyId: vacancyId,
        }),
      ]);
    },
  });
  const saveDraftToHH = api.vacancies.saveHhDraft.useMutation({
    onSuccess: async (result) => {
      setErrors({});
      const details = [
        result.publicationReady ? t("hh.ready") : t("hh.incomplete"),
        result.ignoredFields.length > 0
          ? t("hh.ignoredFields", { fields: result.ignoredFields.join(", ") })
          : null,
        result.validationErrors.length > 0
          ? t("hh.issues", {
              issues: result.validationErrors
                .map((item) => item.value)
                .join(", "),
            })
          : null,
      ].filter((item): item is string => Boolean(item));
      setSavedMessage(
        t("hh.draftSaved", {
          id: result.hhDraftId,
          details: details.length > 0 ? ` (${details.join("; ")})` : "",
        }),
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
        _form: error.message || t("hh.draftError"),
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
      next.title = t("titleRequired");
    } else if (trimmedTitle.length > 255) {
      next.title = t("titleMax");
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
      next.areaId = t("hh.selectCityError");
    }
    if (!fields.professionalRoleId) {
      next.professionalRoleId = t("hh.selectRoleError");
    }
    if (!fields.employmentId) {
      next.employmentId = t("hh.selectEmploymentError");
    }
    if (!fields.scheduleId) {
      next.scheduleId = t("hh.selectScheduleError");
    }
    if (!fields.experienceId) {
      next.experienceId = t("hh.selectExperienceError");
    }
    if (!fields.billingTypeId) {
      next.billingTypeId = t("hh.selectPublicationTypeError");
    }
    if (!fields.vacancyTypeId) {
      next.vacancyTypeId = t("hh.selectVacancyTypeError");
    }
    if (!hasMeaningfulHtml(fields.descriptionHtml)) {
      next.descriptionHtml = t("hh.vacancyDescriptionRequired");
    } else if (fields.descriptionHtml.length < 200) {
      next.descriptionHtml = t("hh.descriptionMin");
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
      if (pubId) {
        // Existing publication: publish to hh.uz first, then persist the field
        // edits locally — a rejection leaves the saved publication untouched.
        await publishToHH.mutateAsync({
          ...fields,
          name: fields.title.trim(),
          vacancyId: pubId,
          ...getSalaryPayload(),
        });
        await updatePublication.mutateAsync({
          id: pubId,
          ...fields,
          title: fields.title.trim(),
          isActive: true,
          isPublication: true,
        });
      } else {
        // New publication: hh.uz needs a vacancy id, so the row is created
        // first and removed again if hh.uz rejects it — nothing stays saved.
        const created = await createPublication.mutateAsync({
          parentId: vacancyId,
          ...fields,
          title: fields.title.trim(),
          isActive: true,
          isPublication: true,
          destination: "hh.uz",
        });
        try {
          await publishToHH.mutateAsync({
            ...fields,
            name: fields.title.trim(),
            vacancyId: created.id,
            ...getSalaryPayload(),
          });
        } catch (error) {
          await deletePublication
            .mutateAsync({ id: created.id })
            .catch(() => undefined);
          throw error;
        }
      }
      router.push(`/vacancies/${vacancyId}?step=publications`);
    } catch {
      // Mutation handlers surface the error in the form.
    }
  };

  const handleSaveHhDraft = async () => {
    if (!validateDraft() || !vacancyQuery.data) {
      return;
    }

    const buildDraftPayload = (localVacancyId: string) => ({
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

    try {
      if (pubId) {
        // Existing publication: save the hh.uz draft first, then persist the
        // local field edits — a rejection leaves the publication untouched.
        await saveDraftToHH.mutateAsync(buildDraftPayload(pubId));
        await updatePublication.mutateAsync({
          id: pubId,
          ...fields,
          title: fields.title.trim(),
          isActive: getCurrentIsActive(),
          isPublication: true,
        });
      } else {
        // New publication: hh.uz needs a vacancy id, so the row is created
        // first and removed again if hh.uz rejects the draft.
        const created = await createPublication.mutateAsync({
          parentId: vacancyId,
          ...fields,
          title: fields.title.trim(),
          isActive: getCurrentIsActive(),
          isPublication: true,
          destination: "hh.uz",
        });
        try {
          await saveDraftToHH.mutateAsync(buildDraftPayload(created.id));
        } catch (error) {
          await deletePublication
            .mutateAsync({ id: created.id })
            .catch(() => undefined);
          throw error;
        }
        router.replace(
          `/vacancies/${vacancyId}/publications/hh.uz/${created.id}`,
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
      <LoadingState
        className="h-full min-h-[55vh] flex-1 text-text-placeholder"
        label={t("vacancyLoading")}
      />
    );
  }

  if (!vacancyQuery.data) {
    return (
      <main className="flex h-full flex-1 items-center justify-center text-text-placeholder">
        {t("vacancyNotFound")}
      </main>
    );
  }

  return (
    <main className="relative w-full bg-bg-canvas">
      <div className="app-page-narrow flex flex-col">
        <div className="w-full">
          <Breadcrumbs
            label={t("hh.pageTitle")}
            parent={{
              label: vacancyQuery.data.title || t("vacancy"),
              href: `/vacancies/${vacancyId}`,
            }}
            rootHref="/vacancies"
            rootLabel={navigationT("vacancies")}
          />

          <h1 className="page-title mt-5 mb-5">{t("hh.pageTitle")}</h1>

          <FeedbackPresence className="mb-4" show={hhLookupsQuery.isError}>
            <div className="mb-4 rounded-lg border border-danger-red-bg bg-danger-red-bg px-3 py-2 text-danger-red text-sm">
              {t("hh.lookupsError")}{" "}
              <button
                className="underline"
                onClick={() => void hhLookupsQuery.refetch()}
                type="button"
              >
                {commonT("retry")}
              </button>
            </div>
          </FeedbackPresence>

          <div className="flex flex-col gap-5">
            <div
              className="surface-card scroll-mt-24 p-5 sm:p-6"
              id="basic-information"
            >
              <ClosableSection title={t("hh.mainInfo")}>
                <div className="flex min-w-0 flex-col gap-2">
                  <Input
                    label={t("publicationTitle")}
                    maxLength={255}
                    onChange={(event) =>
                      setHhField("title", event.target.value)
                    }
                    placeholder={t("titlePlaceholder")}
                    value={fields.title}
                  />
                  {errors.title && (
                    <p className="text-danger-red text-xs leading-[1.4]">
                      {errors.title}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="flex min-w-0 flex-col gap-2">
                    <SearchableSelect
                      label={t("hh.city")}
                      onChange={(value) => handleFieldChange("areaId", value)}
                      options={areaOptions}
                      placeholder={t("hh.selectCity")}
                      searchPlaceholder={t("hh.searchCity")}
                      value={fields.areaId}
                    />
                    {errors.areaId && (
                      <p className="text-danger-red text-xs leading-[1.4]">
                        {errors.areaId}
                      </p>
                    )}
                  </div>

                  <div className="flex min-w-0 flex-col gap-2">
                    <SearchableSelect
                      label={t("hh.role")}
                      onChange={(value) =>
                        handleFieldChange("professionalRoleId", value)
                      }
                      options={professionalRoleOptions}
                      placeholder={t("hh.selectRole")}
                      searchPlaceholder={t("hh.searchRole")}
                      value={fields.professionalRoleId}
                    />
                    {errors.professionalRoleId && (
                      <p className="text-danger-red text-xs leading-[1.4]">
                        {errors.professionalRoleId}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="flex min-w-0 flex-col gap-2">
                    <Dropdown
                      label={t("hh.employment")}
                      onChange={(value) =>
                        handleFieldChange("employmentId", value)
                      }
                      options={employmentOptions}
                      placeholder={t("hh.selectType")}
                      value={fields.employmentId}
                    />
                    {errors.employmentId && (
                      <p className="text-danger-red text-xs leading-[1.4]">
                        {errors.employmentId}
                      </p>
                    )}
                  </div>

                  <div className="flex min-w-0 flex-col gap-2">
                    <Dropdown
                      label={t("hh.schedule")}
                      onChange={(value) =>
                        handleFieldChange("scheduleId", value)
                      }
                      options={scheduleOptions}
                      placeholder={t("hh.selectSchedule")}
                      value={fields.scheduleId}
                    />
                    {errors.scheduleId && (
                      <p className="text-danger-red text-xs leading-[1.4]">
                        {errors.scheduleId}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="flex min-w-0 flex-col gap-2">
                    <Dropdown
                      label={t("hh.experience")}
                      onChange={(value) =>
                        handleFieldChange("experienceId", value)
                      }
                      options={experienceOptions}
                      placeholder={t("hh.selectExperience")}
                      value={fields.experienceId}
                    />
                    {errors.experienceId && (
                      <p className="text-danger-red text-xs leading-[1.4]">
                        {errors.experienceId}
                      </p>
                    )}
                  </div>

                  <div className="flex min-w-0 flex-col gap-2">
                    <Dropdown
                      label={t("hh.vacancyType")}
                      onChange={(value) =>
                        handleFieldChange("vacancyTypeId", value)
                      }
                      options={vacancyTypeOptions}
                      placeholder={t("hh.selectVacancyType")}
                      value={fields.vacancyTypeId}
                    />
                    {errors.vacancyTypeId && (
                      <p className="text-danger-red text-xs leading-[1.4]">
                        {errors.vacancyTypeId}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="flex min-w-0 flex-col gap-2">
                    <Dropdown
                      label={t("hh.publicationType")}
                      onChange={(value) =>
                        handleFieldChange("billingTypeId", value)
                      }
                      options={billingTypeOptions}
                      placeholder={t("hh.selectPublicationType")}
                      value={fields.billingTypeId}
                    />
                    {errors.billingTypeId && (
                      <p className="text-danger-red text-xs leading-[1.4]">
                        {errors.billingTypeId}
                      </p>
                    )}
                  </div>
                </div>
              </ClosableSection>
            </div>

            <div
              className="surface-card scroll-mt-24 p-5 sm:p-6"
              id="description"
            >
              <ClosableSection title={t("hh.descriptionTitle")}>
                <RichTextEditor
                  id="hh-description-html"
                  label={t("hh.descriptionLabel")}
                  maxLength={20000}
                  onChange={(html) =>
                    handleFieldChange("descriptionHtml", html)
                  }
                  placeholder={t("hh.descriptionPlaceholder")}
                  value={fields.descriptionHtml}
                />
                {errors.descriptionHtml && (
                  <p className="text-danger-red text-xs leading-[1.4]">
                    {errors.descriptionHtml}
                  </p>
                )}
                <p className="text-text-secondary text-xs">
                  {t("hh.formattingHint")}
                </p>
              </ClosableSection>
            </div>
          </div>

          <div className="sticky bottom-0 z-10 mt-6 border-border-input border-t bg-bg-frosted py-4 backdrop-blur-xl">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex min-h-[20px] flex-col gap-1">
                <FeedbackPresence show={Boolean(errors._form)}>
                  <p className="text-danger-red text-xs leading-[1.4]">
                    {errors._form}
                  </p>
                </FeedbackPresence>
                <FeedbackPresence show={Boolean(savedMessage)}>
                  <p className="text-success-green text-xs leading-[1.4]">
                    {savedMessage}
                  </p>
                </FeedbackPresence>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <Dropdown
                  className="w-full min-w-[240px] sm:w-[260px]"
                  label={t("hh.action")}
                  onChange={(value) => setSubmitAction(value as HhSubmitAction)}
                  options={submitActionOptions}
                  value={submitAction}
                />
                <button
                  className="ui-button ui-button-secondary"
                  onClick={() =>
                    router.push(`/vacancies/${vacancyId}?step=publications`)
                  }
                  type="button"
                >
                  {commonT("back")}
                </button>
                <button
                  className="ui-button ui-button-primary"
                  disabled={
                    createPublication.isPending ||
                    updatePublication.isPending ||
                    saveDraftToHH.isPending ||
                    publishToHH.isPending
                  }
                  onClick={handleSubmitAction}
                  type="button"
                >
                  <LoadingButtonContent
                    isLoading={
                      createPublication.isPending ||
                      updatePublication.isPending ||
                      saveDraftToHH.isPending ||
                      publishToHH.isPending
                    }
                    label={submitButtonLabels[submitAction]}
                    loadingLabel={commonT("saving")}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <PublicationConfirmationModal
        confirmLabel={t("publish")}
        description={t("hh.confirmDescription")}
        isOpen={isPublishConfirmOpen}
        isPending={
          createPublication.isPending ||
          updatePublication.isPending ||
          publishToHH.isPending
        }
        onClose={() => setIsPublishConfirmOpen(false)}
        onConfirm={() => void handlePublish()}
        onReject={() => setIsPublishConfirmOpen(false)}
        rejectLabel={commonT("cancel")}
        title={t("publishQuestion")}
      />
    </main>
  );
}
