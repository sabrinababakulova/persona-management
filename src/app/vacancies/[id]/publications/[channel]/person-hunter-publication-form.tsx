"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Breadcrumbs } from "~/app/_components/Breadcrumbs";
import { Checkbox } from "~/app/_components/checkbox";
import { ClosableSection } from "~/app/_components/closable-section";
import { Dropdown } from "~/app/_components/dropdown";
import { Input } from "~/app/_components/input";
import { Textarea } from "~/app/_components/textarea";
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

/** Strips HTML tags so a rich-text vacancy description can seed PersonHunters' plain-text fields. */
function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li)>/gi, "\n")
    .replace(/<li>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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

  // Seed the text/salary fields from the base vacancy once it loads.
  useEffect(() => {
    const vacancy = vacancyQuery.data;
    if (!vacancy) {
      return;
    }
    setName(vacancy.title ?? "");
    setDescription(htmlToPlainText(vacancy.descriptionHtml ?? ""));
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
    if (!duties.trim()) {
      next.duties = "Заполните обязанности";
    }
    if (!requirements.trim()) {
      next.requirements = "Заполните требования";
    }
    if (!conditions.trim()) {
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
        isPublication: true,
      });
      return;
    }

    createPublication.mutate({
      parentId: vacancyId,
      title: name.trim(),
      descriptionHtml: description.trim() || undefined,
      destination: "person-hunter",
      isActive: true,
      isPublication: true,
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

              <Textarea
                label="Описание компании"
                maxLength={20000}
                onChange={(event) => setDescription(event.currentTarget.value)}
                placeholder="Краткое описание компании (необязательно)"
                value={description}
              />

              <div className="flex min-w-0 flex-col gap-2">
                <Textarea
                  label="Обязанности"
                  maxLength={20000}
                  onChange={(event) => setDuties(event.currentTarget.value)}
                  placeholder="Что предстоит делать"
                  value={duties}
                />
                {errorText("duties")}
              </div>

              <div className="flex min-w-0 flex-col gap-2">
                <Textarea
                  label="Требования"
                  maxLength={20000}
                  onChange={(event) =>
                    setRequirements(event.currentTarget.value)
                  }
                  placeholder="Что мы ожидаем от кандидата"
                  value={requirements}
                />
                {errorText("requirements")}
              </div>

              <div className="flex min-w-0 flex-col gap-2">
                <Textarea
                  label="Условия"
                  maxLength={20000}
                  onChange={(event) => setConditions(event.currentTarget.value)}
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
