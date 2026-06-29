"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Breadcrumbs } from "~/app/_components/Breadcrumbs";
import { Checkbox } from "~/app/_components/checkbox";
import { ClosableSection } from "~/app/_components/closable-section";
import { Dropdown } from "~/app/_components/dropdown";
import { Input } from "~/app/_components/input";
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
  const router = useRouter();
  const utils = api.useUtils();
  const vacancyQuery = api.vacancies.get.useQuery({ id: pubId ?? vacancyId });
  const configQuery = api.vacancies.getPersonHunterConfig.useQuery();
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
  const [lang, setLang] = useState("ru");

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
      setSavedMessage("Опубликовано на PersonHunters");
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
        _form: error.message || "Не удалось опубликовать на PersonHunters",
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
      setErrors({ _form: error.message || "Не удалось сохранить публикацию" });
    },
  });

  // Edit mode only updates the local publication row; PersonHunters is not re-published here.
  const updatePublication = api.vacancies.update.useMutation({
    onSuccess: async () => {
      setErrors({});
      setSavedMessage("Публикация обновлена");
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
      setErrors({ _form: error.message || "Не удалось обновить публикацию" });
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
      next.name = "Введите название вакансии";
    }
    if (!hasMeaningfulHtml(duties)) {
      next.duties = "Заполните обязанности";
    }
    if (!hasMeaningfulHtml(requirements)) {
      next.requirements = "Заполните требования";
    }
    if (!hasMeaningfulHtml(conditions)) {
      next.conditions = "Заполните условия";
    }
    if (employmentIds.length === 0) {
      next.employments = "Выберите тип занятости";
    }
    if (scheduleIds.length === 0) {
      next.schedules = "Выберите график работы";
    }

    const from = Number(experienceFrom);
    const to = Number(experienceTo);
    if (!Number.isFinite(from) || !Number.isFinite(to) || from < 0 || to < 0) {
      next.experience = "Укажите корректный опыт работы";
    } else if (to < from) {
      next.experience = "«Опыт до» не может быть меньше «опыта от»";
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
      <p className="text-[13px] text-danger-red leading-[1.4]">{errors[key]}</p>
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
      <main className="flex h-full flex-1 items-center justify-center text-text-placeholder">
        Загрузка...
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
        <div className="w-full max-w-225">
          <Breadcrumbs
            label="Публикация на PersonHunters"
            parent={{
              label: vacancyQuery.data.title || "Вакансия",
              href: `/vacancies/${vacancyId}`,
            }}
            rootHref="/vacancies"
            rootLabel="Вакансии"
          />

          <h1 className="mt-6 mb-6 font-bold text-[44px] text-text-heading leading-none tracking-[-0.64px]">
            Публикация на PersonHunters
          </h1>
        </div>

        {!isConfigured && (
          <div className="mb-6 w-full max-w-225 rounded-lg border border-danger-red bg-status-closed-bg px-4 py-3 text-[14px] text-danger-red leading-[1.4]">
            Интеграция PersonHunters не настроена: отсутствует API-ключ
            (PERSON_HUNTER_API_KEY).
          </div>
        )}

        <div className="mt-2 flex w-full max-w-225 flex-col gap-8">
          {/* Content */}
          <div className="scroll-mt-24 rounded-lg border border-border-input bg-bg-light p-4 lg:p-6">
            <ClosableSection title="Контент публикации">
              <div className="flex min-w-0 flex-col gap-2">
                <Input
                  label="Название вакансии"
                  maxLength={500}
                  onChange={(event) => setName(event.currentTarget.value)}
                  placeholder="Например, PHP Разработчик"
                  value={name}
                />
                {errorText("name")}
              </div>

              <RichTextEditor
                id="person-hunter-description"
                label="Описание компании"
                maxLength={20000}
                onChange={setDescription}
                placeholder="Краткое описание компании (необязательно)"
                value={description}
              />

              <div className="flex min-w-0 flex-col gap-2">
                <RichTextEditor
                  id="person-hunter-duties"
                  label="Обязанности"
                  maxLength={20000}
                  onChange={setDuties}
                  placeholder="Что предстоит делать"
                  value={duties}
                />
                {errorText("duties")}
              </div>

              <div className="flex min-w-0 flex-col gap-2">
                <RichTextEditor
                  id="person-hunter-requirements"
                  label="Требования"
                  maxLength={20000}
                  onChange={setRequirements}
                  placeholder="Что мы ожидаем от кандидата"
                  value={requirements}
                />
                {errorText("requirements")}
              </div>

              <div className="flex min-w-0 flex-col gap-2">
                <RichTextEditor
                  id="person-hunter-conditions"
                  label="Условия"
                  maxLength={20000}
                  onChange={setConditions}
                  placeholder="Что мы предлагаем"
                  value={conditions}
                />
                {errorText("conditions")}
              </div>
            </ClosableSection>
          </div>

          {/* Placement / references */}
          <div className="scroll-mt-24 rounded-lg border border-border-input bg-bg-light p-4 lg:p-6">
            <ClosableSection title="Параметры вакансии">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Dropdown
                  label="Отрасль"
                  onChange={setIndustryId}
                  options={toDropdownOptions(references?.industries ?? [])}
                  value={industryId}
                />
                <Dropdown
                  label="Статус"
                  onChange={setStatusId}
                  options={toDropdownOptions(references?.statuses ?? [])}
                  value={statusId}
                />
                <Dropdown
                  label="Страна"
                  onChange={setCountryId}
                  options={toDropdownOptions(references?.countries ?? [])}
                  value={countryId}
                />
                <Dropdown
                  label="Регион (область)"
                  onChange={setRegionId}
                  options={toDropdownOptions(references?.regions ?? [])}
                  value={regionId}
                />
                <Dropdown
                  label="Город"
                  onChange={setCityId}
                  options={toDropdownOptions(references?.cities ?? [])}
                  value={cityId}
                />
                <Dropdown
                  label="Язык публикации"
                  onChange={setLang}
                  options={languageOptions}
                  value={lang}
                />
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="flex flex-col gap-3">
                  <span className="font-medium text-[16px] text-text-label leading-[1.4] tracking-[-0.32px]">
                    Тип занятости
                  </span>
                  {(references?.employments ?? []).map((option) => (
                    <div className="flex items-center gap-2" key={option.id}>
                      <Checkbox
                        checked={employmentIds.includes(option.id)}
                        onChange={() =>
                          toggleId(employmentIds, setEmploymentIds, option.id)
                        }
                      />
                      <span className="text-[14px] text-text-heading leading-[1.4]">
                        {option.name}
                      </span>
                    </div>
                  ))}
                  {errorText("employments")}
                </div>

                <div className="flex flex-col gap-3">
                  <span className="font-medium text-[16px] text-text-label leading-[1.4] tracking-[-0.32px]">
                    График работы
                  </span>
                  {(references?.schedules ?? []).map((option) => (
                    <div className="flex items-center gap-2" key={option.id}>
                      <Checkbox
                        checked={scheduleIds.includes(option.id)}
                        onChange={() =>
                          toggleId(scheduleIds, setScheduleIds, option.id)
                        }
                      />
                      <span className="text-[14px] text-text-heading leading-[1.4]">
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
                  label="Опыт работы от (лет)"
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
                  label="Опыт работы до (лет)"
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
          <div className="scroll-mt-24 rounded-lg border border-border-input bg-bg-light p-4 lg:p-6">
            <ClosableSection title="Зарплата">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <Input
                  inputMode="numeric"
                  label="Зарплата от"
                  maxLength={20}
                  onChange={(event) =>
                    setPayFrom(
                      formatNumberWithSpaces(event.currentTarget.value),
                    )
                  }
                  placeholder="например, 5 000 000"
                  value={payFrom}
                />
                <Input
                  inputMode="numeric"
                  label="Зарплата до"
                  maxLength={20}
                  onChange={(event) =>
                    setPayTo(formatNumberWithSpaces(event.currentTarget.value))
                  }
                  placeholder="например, 8 000 000"
                  value={payTo}
                />
                <Dropdown
                  label="Валюта"
                  onChange={setCurrencyId}
                  options={toDropdownOptions(references?.currencies ?? [])}
                  value={currencyId}
                />
              </div>
            </ClosableSection>
          </div>
        </div>

        <div className="sticky bottom-0 z-10 mt-8 w-full max-w-225 border-border-input border-t bg-bg-light py-4 backdrop-blur-[10px]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex min-h-[20px] flex-col gap-1">
              {errorText("_form")}
              {savedMessage && (
                <p className="text-[13px] text-success-green leading-[1.4]">
                  {savedMessage}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                className="h-10 rounded-md border border-border-input px-4 font-semibold text-[16px] text-text-secondary leading-none tracking-[-0.32px] transition-colors hover:bg-bg-hover"
                onClick={() =>
                  router.push(`/vacancies/${vacancyId}?step=publications`)
                }
                type="button"
              >
                Назад
              </button>
              <button
                className="h-10 rounded-md bg-primary-blue-light px-4 font-semibold text-[16px] text-primary-blue leading-none tracking-[-0.32px] transition-colors hover:bg-primary-blue-light-hover disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSubmitting || (!pubId && !isConfigured)}
                onClick={handleSubmit}
                type="button"
              >
                {isSubmitting
                  ? pubId
                    ? "Сохранение..."
                    : "Публикация..."
                  : pubId
                    ? "Сохранить изменения"
                    : "Опубликовать"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <PublicationConfirmationModal
        confirmLabel={pubId ? "Обновить" : "Опубликовать"}
        description={
          pubId
            ? "Изменения будут сохранены в базе данных без повторной публикации на PersonHunters."
            : "Публикация будет сохранена и отправлена на PersonHunters."
        }
        isOpen={isConfirmOpen}
        isPending={isSubmitting}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleConfirmSubmit}
        onReject={() => setIsConfirmOpen(false)}
        rejectLabel="Отмена"
        title={pubId ? "Обновить публикацию?" : "Опубликовать публикацию?"}
      />
    </main>
  );
}
