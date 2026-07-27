"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { Breadcrumbs } from "~/app/_components/Breadcrumbs";
import { Checkbox } from "~/app/_components/checkbox";
import { ClosableSection } from "~/app/_components/closable-section";
import { Dropdown } from "~/app/_components/dropdown";
import { Input } from "~/app/_components/input";
import {
  FeedbackPresence,
  LoadingButtonContent,
  LoadingState,
} from "~/app/_components/motion-system";
import { RichTextEditor } from "~/app/_components/rich-text-editor";
import { api } from "~/trpc/react";
import {
  formatNumberWithSpaces,
  parseFormattedNumber,
} from "~/utils/format-salaries";
import { PublicationConfirmationModal } from "./publication-confirmation-modal";

type PersonHunterErrors = Partial<
  Record<
    | "name"
    | "duties"
    | "requirements"
    | "conditions"
    | "employments"
    | "schedules"
    | "experience"
    | "_form",
    string
  >
>;

/** Returns true when the supplied HTML contains visible text (ignores empty tags like `<p></p>`). */
function hasMeaningfulHtml(html: string): boolean {
  return html.replace(/<[^>]*>/g, "").trim().length > 0;
}

/** Maps reference options ({ id, name }) to the `{ value, label }` shape the Dropdown expects. */
function toDropdownOptions(
  options: ReadonlyArray<{ id: number; name: string }>,
) {
  return options.map((option) => ({
    value: String(option.id),
    label: option.name,
  }));
}

/**
 * Publication editor for the PersonHunters channel
 * (`/vacancies/[id]/publications/person-hunter`).
 *
 * On submit it saves a per-channel publication row (`destination: "person-hunter"`) and then
 * calls `vacancies.publishPersonHunter`, which creates the vacancy on PersonHunters and stores
 * its id back on the row — mirroring the hh.uz / Telegram publish flows.
 *
 * PersonHunters exposes no reference dictionaries, so the selectable IDs (industry, city,
 * employment, …) come from the curated list returned by `vacancies.getPersonHunterConfig`.
 */
export function PersonHunterPublicationForm({
  vacancyId,
  pubId,
}: {
  vacancyId: string;
  pubId?: string;
}) {
  const locale = useLocale();
  const t = useTranslations("Publications");
  const commonT = useTranslations("Common");
  const navigationT = useTranslations("Navigation");
  const router = useRouter();
  const utils = api.useUtils();
  const vacancyQuery = api.vacancies.get.useQuery({ id: pubId ?? vacancyId });
  const configQuery = api.vacancies.getPersonHunterConfig.useQuery({
    lang: locale,
  });
  // When editing, pull the live PersonHunters data as a fallback for fields not stored locally
  // (publications created before `personHunterMeta` existed have no saved meta).
  const personHunterPublicationQuery =
    api.vacancies.getPersonHunterPublication.useQuery(
      { id: pubId ?? "" },
      { enabled: Boolean(pubId) },
    );

  const references = configQuery.data?.references;
  const isConfigured = configQuery.data?.enabled ?? false;

  // Text content.
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [duties, setDuties] = useState("");
  const [requirements, setRequirements] = useState("");
  const [conditions, setConditions] = useState("");

  // Single-select reference IDs (held as strings to match the Dropdown component).
  const [industryId, setIndustryId] = useState("");
  const [countryId, setCountryId] = useState("");
  const [regionId, setRegionId] = useState("");
  const [cityId, setCityId] = useState("");
  const [currencyId, setCurrencyId] = useState("");
  const [statusId, setStatusId] = useState("");
  const [lang, setLang] = useState(locale);

  // Multi-select reference IDs.
  const [employmentIds, setEmploymentIds] = useState<number[]>([]);
  const [scheduleIds, setScheduleIds] = useState<number[]>([]);

  // Numeric fields.
  const [experienceFrom, setExperienceFrom] = useState("0");
  const [experienceTo, setExperienceTo] = useState("1");
  const [payFrom, setPayFrom] = useState("");
  const [payTo, setPayTo] = useState("");

  const [errors, setErrors] = useState<PersonHunterErrors>({});
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  // Seed the text/salary fields from the base vacancy once it loads, then overlay any
  // PersonHunters-specific fields saved on the publication row (edit mode) so the form is
  // restored exactly as it was last submitted.
  useEffect(() => {
    const vacancy = vacancyQuery.data;
    if (!vacancy) {
      return;
    }
    setName(vacancy.title ?? "");
    setDescription(vacancy.descriptionHtml ?? "");
    setPayFrom(
      vacancy.salaryFrom != null
        ? formatNumberWithSpaces(String(vacancy.salaryFrom))
        : "",
    );
    setPayTo(
      vacancy.salaryTo != null
        ? formatNumberWithSpaces(String(vacancy.salaryTo))
        : "",
    );

    const meta = vacancy.personHunterMeta;
    if (meta) {
      setDuties(meta.duties ?? "");
      setRequirements(meta.requirements ?? "");
      setConditions(meta.conditions ?? "");
      if (meta.industryId != null) setIndustryId(String(meta.industryId));
      if (meta.countryId != null) setCountryId(String(meta.countryId));
      if (meta.regionId != null) setRegionId(String(meta.regionId));
      if (meta.cityId != null) setCityId(String(meta.cityId));
      if (meta.currencyId != null) setCurrencyId(String(meta.currencyId));
      if (meta.statusId != null) setStatusId(String(meta.statusId));
      if (meta.lang) setLang(meta.lang);
      if (meta.employmentIds) setEmploymentIds(meta.employmentIds);
      if (meta.scheduleIds) setScheduleIds(meta.scheduleIds);
      if (meta.experienceFrom != null)
        setExperienceFrom(String(meta.experienceFrom));
      if (meta.experienceTo != null) setExperienceTo(String(meta.experienceTo));
    }
  }, [vacancyQuery.data]);

  // Default each single-select to the first available reference option once they load.
  useEffect(() => {
    if (!references) {
      return;
    }
    setIndustryId((prev) => prev || String(references.industries[0]?.id ?? ""));
    setCountryId((prev) => prev || String(references.countries[0]?.id ?? ""));
    setRegionId((prev) => prev || String(references.regions[0]?.id ?? ""));
    setCityId((prev) => prev || String(references.cities[0]?.id ?? ""));
    setCurrencyId((prev) => prev || String(references.currencies[0]?.id ?? ""));
    setStatusId((prev) => prev || String(references.statuses[0]?.id ?? ""));
  }, [references]);

  // Fall back to the live PersonHunters data for fields with no saved local meta — covers
  // publications created before `personHunterMeta` existed and any edits made directly on
  // PersonHunters. Local meta stays authoritative, so this is skipped once meta is present.
  useEffect(() => {
    const remote = personHunterPublicationQuery.data;
    if (!remote || vacancyQuery.data?.personHunterMeta) {
      return;
    }
    setDuties(remote.duties ?? "");
    setRequirements(remote.requirements ?? "");
    setConditions(remote.conditions ?? "");
    if (remote.description) setDescription(remote.description);
    if (remote.industryId != null) setIndustryId(String(remote.industryId));
    if (remote.countryId != null) setCountryId(String(remote.countryId));
    if (remote.regionId != null) setRegionId(String(remote.regionId));
    if (remote.cityId != null) setCityId(String(remote.cityId));
    if (remote.statusId != null) setStatusId(String(remote.statusId));
    if (remote.employmentIds.length > 0) setEmploymentIds(remote.employmentIds);
    if (remote.scheduleIds.length > 0) setScheduleIds(remote.scheduleIds);
    if (remote.experienceFrom != null)
      setExperienceFrom(String(remote.experienceFrom));
    if (remote.experienceTo != null)
      setExperienceTo(String(remote.experienceTo));
    if (remote.payFrom != null)
      setPayFrom(formatNumberWithSpaces(String(remote.payFrom)));
    if (remote.payTo != null)
      setPayTo(formatNumberWithSpaces(String(remote.payTo)));
  }, [personHunterPublicationQuery.data, vacancyQuery.data]);

  const publishPersonHunter = api.vacancies.publishPersonHunter.useMutation({
    onSuccess: async () => {
      setErrors({});
      setSavedMessage(t("personHunter.published"));
      setIsConfirmOpen(false);
      await Promise.all([
        utils.vacancies.get.invalidate({ id: vacancyId }),
        utils.vacancies.list.invalidate(),
        utils.vacancies.listPublications.invalidate({
          parentVacancyId: vacancyId,
        }),
      ]);
      router.push(`/vacancies/${vacancyId}?step=publications`);
    },
    onError: (error) => {
      setSavedMessage(null);
      setIsConfirmOpen(false);
      setErrors({
        _form: error.message || t("personHunter.publishError"),
      });
    },
  });

  const createPublication = api.vacancies.create.useMutation({
    onSuccess: async (publication) => {
      setErrors({});
      await utils.vacancies.listPublications.invalidate({
        parentVacancyId: vacancyId,
      });
      publishPersonHunter.mutate(buildPublishInput(publication.id));
    },
    onError: (error) => {
      setSavedMessage(null);
      setIsConfirmOpen(false);
      setErrors({ _form: error.message || t("saveError") });
    },
  });

  // Edit mode saves the local publication row and mirrors the changes to PersonHunters
  // (vacancies.update issues a PUT /vacancies/{id} when the row is a PersonHunters publication).
  const updatePublication = api.vacancies.update.useMutation({
    onSuccess: async () => {
      setErrors({});
      setSavedMessage(t("updated"));
      setIsConfirmOpen(false);
      await Promise.all([
        utils.vacancies.get.invalidate({ id: vacancyId }),
        pubId ? utils.vacancies.get.invalidate({ id: pubId }) : undefined,
        utils.vacancies.listPublications.invalidate({
          parentVacancyId: vacancyId,
        }),
      ]);
      router.push(`/vacancies/${vacancyId}?step=publications`);
    },
    onError: (error) => {
      setSavedMessage(null);
      setIsConfirmOpen(false);
      setErrors({ _form: error.message || t("updateError") });
    },
  });

  /**
   * Snapshots the PersonHunters-specific fields that have no base-vacancy column, so they can be
   * persisted on the publication row and re-hydrated when the recruiter edits this publication.
   */
  const buildMeta = () => ({
    duties: duties.trim(),
    requirements: requirements.trim(),
    conditions: conditions.trim(),
    industryId: industryId ? Number(industryId) : undefined,
    countryId: countryId ? Number(countryId) : undefined,
    regionId: regionId ? Number(regionId) : undefined,
    cityId: cityId ? Number(cityId) : undefined,
    currencyId: currencyId ? Number(currencyId) : undefined,
    statusId: statusId ? Number(statusId) : undefined,
    lang: lang as "ru" | "uz" | "en",
    employmentIds,
    scheduleIds,
    experienceFrom: Number(experienceFrom),
    experienceTo: Number(experienceTo),
  });

  /** Builds the `publishPersonHunter` input from current form state for the given publication id. */
  const buildPublishInput = (publicationId: string) => ({
    vacancyId: publicationId,
    name: name.trim(),
    description: description.trim() || undefined,
    duties: duties.trim(),
    requirements: requirements.trim(),
    conditions: conditions.trim(),
    industryId: Number(industryId),
    countryId: Number(countryId),
    regionId: Number(regionId),
    cityId: Number(cityId),
    currencyId: currencyId ? Number(currencyId) : undefined,
    status: Number(statusId),
    experienceFrom: Number(experienceFrom),
    experienceTo: Number(experienceTo),
    employmentIds,
    scheduleIds,
    payFrom: payFrom ? parseFormattedNumber(payFrom) : null,
    payTo: payTo ? parseFormattedNumber(payTo) : null,
    lang: lang as "ru" | "uz" | "en",
  });

  const toggleId = (
    current: number[],
    setter: (next: number[]) => void,
    id: number,
  ) => {
    setSavedMessage(null);
    setter(
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  };

  const validate = (): boolean => {
    const next: PersonHunterErrors = {};

    if (!name.trim()) {
      next.name = t("personHunter.vacancyTitleRequired");
    }
    if (!hasMeaningfulHtml(duties)) {
      next.duties = t("personHunter.dutiesRequired");
    }
    if (!hasMeaningfulHtml(requirements)) {
      next.requirements = t("personHunter.requirementsRequired");
    }
    if (!hasMeaningfulHtml(conditions)) {
      next.conditions = t("personHunter.conditionsRequired");
    }
    if (employmentIds.length === 0) {
      next.employments = t("personHunter.employmentRequired");
    }
    if (scheduleIds.length === 0) {
      next.schedules = t("personHunter.scheduleRequired");
    }

    const from = Number(experienceFrom);
    const to = Number(experienceTo);
    if (!Number.isFinite(from) || !Number.isFinite(to) || from < 0 || to < 0) {
      next.experience = t("personHunter.experienceInvalid");
    } else if (to < from) {
      next.experience = t("personHunter.experienceRangeInvalid");
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = () => {
    if (!vacancyQuery.data || !validate()) {
      return;
    }
    setIsConfirmOpen(true);
  };

  const handleConfirmSubmit = () => {
    if (!vacancyQuery.data || !validate()) {
      setIsConfirmOpen(false);
      return;
    }

    if (pubId) {
      updatePublication.mutate({
        id: pubId,
        title: name.trim(),
        descriptionHtml: description.trim() || null,
        salaryFrom: payFrom ? parseFormattedNumber(payFrom) : null,
        salaryTo: payTo ? parseFormattedNumber(payTo) : null,
        isPublication: true,
        personHunterMeta: buildMeta(),
      });
      return;
    }

    createPublication.mutate({
      parentId: vacancyId,
      title: name.trim(),
      descriptionHtml: description.trim() || undefined,
      salaryFrom: payFrom ? parseFormattedNumber(payFrom) : undefined,
      salaryTo: payTo ? parseFormattedNumber(payTo) : undefined,
      destination: "person-hunter",
      isActive: true,
      isPublication: true,
      personHunterMeta: buildMeta(),
    });
  };

  const isSubmitting =
    createPublication.isPending ||
    updatePublication.isPending ||
    publishPersonHunter.isPending;

  const errorText = (key: keyof PersonHunterErrors) =>
    errors[key] ? (
      <p className="text-danger-red text-xs leading-[1.4]">{errors[key]}</p>
    ) : null;

  const languageOptions = useMemo(
    () =>
      (references?.languages ?? []).map((language) => ({
        value: language.id,
        label: language.name,
      })),
    [references],
  );

  if (vacancyQuery.isLoading || configQuery.isLoading) {
    return (
      <LoadingState
        className="h-full min-h-[55vh] flex-1 text-text-placeholder"
        label={t("publicationLoading")}
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
            label={t("personHunter.pageTitle")}
            parent={{
              label: vacancyQuery.data.title || t("vacancy"),
              href: `/vacancies/${vacancyId}`,
            }}
            rootHref="/vacancies"
            rootLabel={navigationT("vacancies")}
          />

          <h1 className="page-title mt-5 mb-5">
            {t("personHunter.pageTitle")}
          </h1>
        </div>

        <FeedbackPresence show={!isConfigured}>
          <div className="mb-5 w-full rounded-lg border border-danger-red bg-status-closed-bg px-4 py-3 text-danger-red text-sm leading-5">
            {t("personHunter.notConfigured")}
          </div>
        </FeedbackPresence>

        <div className="mt-2 flex w-full flex-col gap-5">
          {/* Content */}
          <div className="surface-card scroll-mt-24 p-5 sm:p-6">
            <ClosableSection title={t("personHunter.content")}>
              <div className="flex min-w-0 flex-col gap-2">
                <Input
                  label={t("personHunter.vacancyTitle")}
                  maxLength={500}
                  onChange={(event) => setName(event.currentTarget.value)}
                  placeholder={t("personHunter.vacancyPlaceholder")}
                  value={name}
                />
                {errorText("name")}
              </div>

              <RichTextEditor
                id="person-hunter-description"
                label={t("personHunter.companyDescription")}
                maxLength={20000}
                onChange={setDescription}
                placeholder={t("personHunter.companyDescriptionPlaceholder")}
                value={description}
              />

              <div className="flex min-w-0 flex-col gap-2">
                <RichTextEditor
                  id="person-hunter-duties"
                  label={t("personHunter.duties")}
                  maxLength={20000}
                  onChange={setDuties}
                  placeholder={t("personHunter.dutiesPlaceholder")}
                  value={duties}
                />
                {errorText("duties")}
              </div>

              <div className="flex min-w-0 flex-col gap-2">
                <RichTextEditor
                  id="person-hunter-requirements"
                  label={t("personHunter.requirements")}
                  maxLength={20000}
                  onChange={setRequirements}
                  placeholder={t("personHunter.requirementsPlaceholder")}
                  value={requirements}
                />
                {errorText("requirements")}
              </div>

              <div className="flex min-w-0 flex-col gap-2">
                <RichTextEditor
                  id="person-hunter-conditions"
                  label={t("personHunter.conditions")}
                  maxLength={20000}
                  onChange={setConditions}
                  placeholder={t("personHunter.conditionsPlaceholder")}
                  value={conditions}
                />
                {errorText("conditions")}
              </div>
            </ClosableSection>
          </div>

          {/* Placement / references */}
          <div className="surface-card scroll-mt-24 p-5 sm:p-6">
            <ClosableSection title={t("personHunter.parameters")}>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Dropdown
                  label={t("personHunter.industry")}
                  onChange={setIndustryId}
                  options={toDropdownOptions(references?.industries ?? [])}
                  value={industryId}
                />
                <Dropdown
                  label={t("personHunter.status")}
                  onChange={setStatusId}
                  options={toDropdownOptions(references?.statuses ?? [])}
                  value={statusId}
                />
                <Dropdown
                  label={t("personHunter.country")}
                  onChange={setCountryId}
                  options={toDropdownOptions(references?.countries ?? [])}
                  value={countryId}
                />
                <Dropdown
                  label={t("personHunter.region")}
                  onChange={setRegionId}
                  options={toDropdownOptions(references?.regions ?? [])}
                  value={regionId}
                />
                <Dropdown
                  label={t("personHunter.city")}
                  onChange={setCityId}
                  options={toDropdownOptions(references?.cities ?? [])}
                  value={cityId}
                />
                <Dropdown
                  label={t("personHunter.language")}
                  onChange={(value) => setLang(value as "ru" | "uz" | "en")}
                  options={languageOptions}
                  value={lang}
                />
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="flex flex-col gap-3">
                  <span className="font-medium text-base text-text-label leading-[1.4]">
                    {t("personHunter.employment")}
                  </span>
                  {(references?.employments ?? []).map((option) => (
                    <div className="flex items-center gap-2" key={option.id}>
                      <Checkbox
                        checked={employmentIds.includes(option.id)}
                        onChange={() =>
                          toggleId(employmentIds, setEmploymentIds, option.id)
                        }
                      />
                      <span className="text-sm text-text-heading leading-[1.4]">
                        {option.name}
                      </span>
                    </div>
                  ))}
                  {errorText("employments")}
                </div>

                <div className="flex flex-col gap-3">
                  <span className="font-medium text-base text-text-label leading-[1.4]">
                    {t("personHunter.schedule")}
                  </span>
                  {(references?.schedules ?? []).map((option) => (
                    <div className="flex items-center gap-2" key={option.id}>
                      <Checkbox
                        checked={scheduleIds.includes(option.id)}
                        onChange={() =>
                          toggleId(scheduleIds, setScheduleIds, option.id)
                        }
                      />
                      <span className="text-sm text-text-heading leading-[1.4]">
                        {option.name}
                      </span>
                    </div>
                  ))}
                  {errorText("schedules")}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Input
                  inputMode="numeric"
                  label={t("personHunter.experienceFrom")}
                  onChange={(event) =>
                    setExperienceFrom(
                      event.currentTarget.value.replace(/\D/g, ""),
                    )
                  }
                  placeholder="1"
                  value={experienceFrom}
                />
                <Input
                  inputMode="numeric"
                  label={t("personHunter.experienceTo")}
                  onChange={(event) =>
                    setExperienceTo(
                      event.currentTarget.value.replace(/\D/g, ""),
                    )
                  }
                  placeholder="3"
                  value={experienceTo}
                />
              </div>
              {errorText("experience")}
            </ClosableSection>
          </div>

          {/* Salary */}
          <div className="surface-card scroll-mt-24 p-5 sm:p-6">
            <ClosableSection title={t("personHunter.salary")}>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <Input
                  inputMode="numeric"
                  label={t("personHunter.salaryFrom")}
                  maxLength={20}
                  onChange={(event) =>
                    setPayFrom(
                      formatNumberWithSpaces(event.currentTarget.value),
                    )
                  }
                  placeholder={t("personHunter.salaryFromPlaceholder")}
                  value={payFrom}
                />
                <Input
                  inputMode="numeric"
                  label={t("personHunter.salaryTo")}
                  maxLength={20}
                  onChange={(event) =>
                    setPayTo(formatNumberWithSpaces(event.currentTarget.value))
                  }
                  placeholder={t("personHunter.salaryToPlaceholder")}
                  value={payTo}
                />
                <Dropdown
                  label={t("personHunter.currency")}
                  onChange={setCurrencyId}
                  options={toDropdownOptions(references?.currencies ?? [])}
                  value={currencyId}
                />
              </div>
            </ClosableSection>
          </div>
        </div>

        <div className="sticky bottom-0 z-10 mt-6 w-full border-border-input border-t bg-bg-frosted py-4 backdrop-blur-xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex min-h-[20px] flex-col gap-1">
              {errorText("_form")}
              <FeedbackPresence show={Boolean(savedMessage)}>
                <p className="text-success-green text-xs leading-[1.4]">
                  {savedMessage}
                </p>
              </FeedbackPresence>
            </div>
            <div className="flex flex-wrap items-center gap-3">
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
                disabled={isSubmitting || (!pubId && !isConfigured)}
                onClick={handleSubmit}
                type="button"
              >
                <LoadingButtonContent
                  isLoading={isSubmitting}
                  label={pubId ? commonT("saveChanges") : t("publish")}
                  loadingLabel={pubId ? commonT("saving") : t("publishing")}
                />
              </button>
            </div>
          </div>
        </div>
      </div>

      <PublicationConfirmationModal
        confirmLabel={pubId ? t("update") : t("publish")}
        description={
          pubId
            ? t("personHunter.updateDescription")
            : t("personHunter.publishDescription")
        }
        isOpen={isConfirmOpen}
        isPending={isSubmitting}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleConfirmSubmit}
        onReject={() => setIsConfirmOpen(false)}
        rejectLabel={commonT("cancel")}
        title={pubId ? t("updateQuestion") : t("publishQuestion")}
      />
    </main>
  );
}
