"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Breadcrumbs } from "~/app/_components/Breadcrumbs";
import { Checkbox } from "~/app/_components/checkbox";
import { ClosableSection } from "~/app/_components/closable-section";
import { Dropdown } from "~/app/_components/dropdown";
import { Input } from "~/app/_components/input";
import { RichTextEditor } from "~/app/_components/rich-text-editor";
import { SearchableSelect } from "~/app/_components/searchable-select";
import {
  OLX_DEFAULT_LOCATION,
  sanitizeOlxLocationInput,
} from "~/shared/olx-location";
import {
  formatOlxUzPhoneInput,
  hasOlxUzPhoneDigits,
  normalizeOlxUzPhone,
  OLX_UZ_PHONE_HTML_PATTERN,
  OLX_UZ_PHONE_PREFIX,
} from "~/shared/olx-phone";
import { api } from "~/trpc/react";
import {
  formatNumberWithSpaces,
  parseFormattedNumber,
} from "~/utils/format-salaries";
import { PublicationEditPageSkeleton } from "./[pubid]/publication-edit-page-skeleton";
import { PublicationConfirmationModal } from "./publication-confirmation-modal";
import { PublicationPageSkeleton } from "./publication-page-skeleton";

type OlxErrors = Partial<
  Record<
    | "title"
    | "description"
    | "category"
    | "location"
    | "contactName"
    | "contactPhone"
    | "_form",
    string
  >
>;

function hasVisibleText(html: string): boolean {
  return (
    html
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .trim().length > 0
  );
}

type OlxLocationSelection = {
  cityId: number;
  cityName: string;
  districtId?: number;
  districtName?: string;
  regionId: number;
  regionName: string;
  latitude: number;
  longitude: number;
  label: string;
};

export function OlxPublicationForm({
  vacancyId,
  pubId,
}: {
  vacancyId: string;
  pubId?: string;
}) {
  const t = useTranslations("Publications.olx");
  const commonT = useTranslations("Common");
  const navigationT = useTranslations("Navigation");
  const router = useRouter();
  const utils = api.useUtils();
  const hydratedFor = useRef<string | null>(null);
  const [draftPublicationId, setDraftPublicationId] = useState(pubId ?? "");
  const effectivePublicationId = pubId ?? draftPublicationId;
  const vacancyQuery = api.vacancies.get.useQuery({
    id: effectivePublicationId || vacancyId,
  });
  const configQuery = api.vacancies.getOlxConfig.useQuery();

  const [title, setTitle] = useState("");
  const [descriptionHtml, setDescriptionHtml] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [location, setLocation] = useState(OLX_DEFAULT_LOCATION);
  const [selectedLocation, setSelectedLocation] =
    useState<OlxLocationSelection | null>(null);
  const [debouncedLocation, setDebouncedLocation] =
    useState(OLX_DEFAULT_LOCATION);
  const [employmentType, setEmploymentType] = useState("perm");
  const [schedule, setSchedule] = useState("full");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState(OLX_UZ_PHONE_PREFIX);
  const [salaryFrom, setSalaryFrom] = useState("");
  const [salaryTo, setSalaryTo] = useState("");
  const [salaryCurrency, setSalaryCurrency] = useState<"UZS" | "USD">("UZS");
  const [salaryNegotiable, setSalaryNegotiable] = useState(false);
  const [remoteWork, setRemoteWork] = useState(false);
  const [onlineRecruitment, setOnlineRecruitment] = useState(false);
  const [errors, setErrors] = useState<OlxErrors>({});
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedLocation(location.trim()),
      350,
    );
    return () => window.clearTimeout(timer);
  }, [location]);

  const locationsQuery = api.vacancies.searchOlxLocations.useQuery(
    { query: debouncedLocation },
    {
      enabled:
        debouncedLocation.length >= 2 &&
        configQuery.data?.serviceAvailable === true,
    },
  );

  useEffect(() => {
    const vacancy = vacancyQuery.data;
    const hydrationKey = effectivePublicationId || vacancyId;
    if (!vacancy || !configQuery.data || hydratedFor.current === hydrationKey) {
      return;
    }
    hydratedFor.current = hydrationKey;
    setTitle(vacancy.title ?? "");
    setDescriptionHtml(vacancy.descriptionHtml ?? "");
    setSalaryFrom(
      vacancy.salaryFrom != null
        ? formatNumberWithSpaces(String(vacancy.salaryFrom))
        : "",
    );
    setSalaryTo(
      vacancy.salaryTo != null
        ? formatNumberWithSpaces(String(vacancy.salaryTo))
        : "",
    );
    setSalaryCurrency(vacancy.salaryCurrency === "USD" ? "USD" : "UZS");
    setContactPhone(formatOlxUzPhoneInput(vacancy.contactPhone ?? ""));

    const meta = vacancy.olxBrowserMeta;
    if (meta) {
      const category = configQuery.data.categories.find(
        (item) =>
          item.id === meta.categoryId ||
          item.path.at(-1) === meta.categoryPath.at(-1),
      );
      setCategoryId(category ? String(category.id) : "");
      setLocation(meta.location);
      if (
        meta.cityId &&
        meta.cityName &&
        meta.regionId &&
        meta.regionName &&
        meta.latitude !== undefined &&
        meta.longitude !== undefined
      ) {
        setSelectedLocation({
          cityId: meta.cityId,
          cityName: meta.cityName,
          regionId: meta.regionId,
          regionName: meta.regionName,
          latitude: meta.latitude,
          longitude: meta.longitude,
          label: meta.location,
          ...(meta.districtId && meta.districtName
            ? {
                districtId: meta.districtId,
                districtName: meta.districtName,
              }
            : {}),
        });
      }
      setEmploymentType(meta.employmentType === "temp" ? "temp" : "perm");
      setSchedule(meta.schedule === "part" ? "part" : "full");
      setContactName(meta.contactName ?? "");
      setContactPhone(
        formatOlxUzPhoneInput(meta.contactPhone ?? vacancy.contactPhone ?? ""),
      );
      setSalaryNegotiable(meta.salaryNegotiable);
      setRemoteWork(meta.remoteWork);
      setOnlineRecruitment(meta.onlineRecruitment);
    }
  }, [configQuery.data, effectivePublicationId, vacancyId, vacancyQuery.data]);

  const createPublication = api.vacancies.create.useMutation();
  const updatePublication = api.vacancies.update.useMutation();
  const runOlx = api.vacancies.publishOlx.useMutation();

  const isSubmitting =
    createPublication.isPending ||
    updatePublication.isPending ||
    runOlx.isPending;
  const existingAdvertUrl = vacancyQuery.data?.olxAdvertUrl ?? null;
  const hasContactPhone = hasOlxUzPhoneDigits(contactPhone);
  const normalizedContactPhone = hasContactPhone
    ? normalizeOlxUzPhone(contactPhone)
    : null;

  const buildMeta = () => {
    const category = configQuery.data?.categories.find(
      (item) => String(item.id) === categoryId,
    );
    return {
      ...(category ? { categoryId: category.id } : {}),
      categoryPath: category?.path ?? ["Работа"],
      location: location.trim(),
      ...(selectedLocation ?? {}),
      employmentType,
      schedule,
      ...(contactName.trim() ? { contactName: contactName.trim() } : {}),
      ...(normalizedContactPhone
        ? { contactPhone: normalizedContactPhone }
        : {}),
      salaryNegotiable,
      remoteWork,
      onlineRecruitment,
    };
  };

  const validate = (): boolean => {
    const next: OlxErrors = {};
    if (!title.trim()) next.title = t("titleRequired");
    if (!hasVisibleText(descriptionHtml)) {
      next.description = t("descriptionRequired");
    }
    if (title.trim().length < 16 || title.trim().length > 70) {
      next.title = t("titleLength");
    }
    const descriptionLength = descriptionHtml
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .trim().length;
    if (descriptionLength < 80 || descriptionLength > 9_000) {
      next.description = t("descriptionLength");
    }
    if (!categoryId) next.category = t("categoryRequired");
    if (!location.trim() || !selectedLocation) {
      next.location = t("locationRequired");
    }
    if (contactName.trim().length < 2) {
      next.contactName = t("contactNameRequired");
    }
    if (hasContactPhone && !normalizedContactPhone) {
      next.contactPhone = t("contactPhoneInvalid");
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const saveLocalPublication = async (): Promise<string> => {
    const values = {
      title: title.trim(),
      descriptionHtml,
      salaryFrom: salaryFrom ? parseFormattedNumber(salaryFrom) : null,
      salaryTo: salaryTo ? parseFormattedNumber(salaryTo) : null,
      salaryCurrency,
      contactPhone: normalizedContactPhone,
      isPublication: true as const,
      olxBrowserMeta: buildMeta(),
    };

    if (effectivePublicationId) {
      await updatePublication.mutateAsync({
        id: effectivePublicationId,
        ...values,
      });
      return effectivePublicationId;
    }

    const created = await createPublication.mutateAsync({
      parentId: vacancyId,
      ...values,
      salaryFrom: values.salaryFrom ?? undefined,
      salaryTo: values.salaryTo ?? undefined,
      contactPhone: values.contactPhone ?? undefined,
      destination: "olx.uz",
      isActive: false,
    });
    setDraftPublicationId(created.id);
    return created.id;
  };

  const publishOlx = async () => {
    if (!validate()) return;
    setErrors({});

    try {
      const publicationId = await saveLocalPublication();
      await runOlx.mutateAsync({
        id: publicationId,
        dryRun: false,
      });
      await Promise.all([
        utils.vacancies.get.invalidate({ id: vacancyId }),
        utils.vacancies.get.invalidate({ id: publicationId }),
        utils.vacancies.list.invalidate(),
        utils.vacancies.listPublications.invalidate({
          parentVacancyId: vacancyId,
        }),
      ]);

      router.push(`/vacancies/${vacancyId}?step=publications`);
    } catch (error) {
      setErrors({
        _form: error instanceof Error ? error.message : t("actionError"),
      });
    } finally {
      setIsConfirmOpen(false);
    }
  };

  const errorText = (key: keyof OlxErrors) =>
    errors[key] ? (
      <p className="text-danger-red text-xs leading-5">{errors[key]}</p>
    ) : null;

  if (vacancyQuery.isLoading || configQuery.isLoading) {
    return pubId ? (
      <PublicationEditPageSkeleton />
    ) : (
      <PublicationPageSkeleton />
    );
  }
  if (!vacancyQuery.data) {
    return (
      <main className="flex h-full flex-1 items-center justify-center text-text-placeholder">
        {t("notFound")}
      </main>
    );
  }

  const connected = configQuery.data?.connected ?? false;
  const serviceAvailable = configQuery.data?.serviceAvailable ?? false;
  const categoryOptions =
    configQuery.data?.categories.map((category) => ({
      value: String(category.id),
      label: category.label,
    })) ?? [];
  const locationOptions = locationsQuery.data ?? [];
  const locationSelectOptions = locationOptions.map((option) => ({
    value: `${option.cityId}:${option.districtId ?? 0}`,
    label: option.label,
  }));
  const selectedLocationValue = selectedLocation
    ? `${selectedLocation.cityId}:${selectedLocation.districtId ?? 0}`
    : "";
  const alreadyPublished = Boolean(
    vacancyQuery.data?.olxAdvertId || existingAdvertUrl,
  );

  return (
    <main className="relative w-full bg-bg-canvas">
      <div className="app-page-narrow flex flex-col">
        <Breadcrumbs
          label={t("pageTitle")}
          parent={{
            label: vacancyQuery.data.title || t("vacancy"),
            href: `/vacancies/${vacancyId}`,
          }}
          rootHref="/vacancies"
          rootLabel={navigationT("vacancies")}
        />
        <h1 className="page-title mt-5 mb-5">{t("pageTitle")}</h1>

        {!serviceAvailable ? (
          <div className="mb-5 rounded-lg border border-border-input bg-bg-input px-4 py-3 text-sm leading-5">
            <p className="font-medium text-text-heading">
              {t("serviceUnavailable")}
            </p>
          </div>
        ) : null}

        {alreadyPublished ? (
          <div className="mb-5 rounded-lg border border-border-input bg-bg-input px-4 py-3 text-sm leading-5">
            <p className="font-medium text-text-heading">
              {t("alreadyPublished")}
            </p>
            <p className="mt-1 text-text-secondary">
              {t("alreadyPublishedHint")}
            </p>
            {existingAdvertUrl ? (
              <a
                className="mt-2 inline-block text-primary-blue hover:underline"
                href={existingAdvertUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                {t("openAdvert")}
              </a>
            ) : null}
          </div>
        ) : null}

        <div className="flex w-full flex-col gap-5">
          <div className="surface-card p-5 sm:p-6">
            <ClosableSection title={t("content")}>
              <div className="flex flex-col gap-2">
                <Input
                  label={t("title")}
                  maxLength={255}
                  onChange={(event) => setTitle(event.currentTarget.value)}
                  placeholder={t("titlePlaceholder")}
                  value={title}
                />
                {errorText("title")}
              </div>
              <div className="flex flex-col gap-2">
                <RichTextEditor
                  id="olx-description"
                  label={t("description")}
                  maxLength={20000}
                  onChange={setDescriptionHtml}
                  placeholder={t("descriptionPlaceholder")}
                  value={descriptionHtml}
                />
                {errorText("description")}
              </div>
            </ClosableSection>
          </div>

          <div className="surface-card p-5 sm:p-6">
            <ClosableSection title={t("placement")}>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Dropdown
                    label={t("category")}
                    onChange={setCategoryId}
                    options={categoryOptions}
                    placeholder={t("categoryPlaceholder")}
                    value={categoryId}
                  />
                  {errorText("category")}
                </div>
                <div className="flex flex-col gap-2">
                  <SearchableSelect
                    displayValue={location}
                    filterOptions={false}
                    label={t("location")}
                    onChange={(value) => {
                      const nextLocation = locationOptions.find(
                        (option) =>
                          `${option.cityId}:${option.districtId ?? 0}` ===
                          value,
                      );
                      if (!nextLocation) return;

                      setLocation(nextLocation.label);
                      setSelectedLocation(nextLocation);
                      setErrors((current) => ({
                        ...current,
                        location: undefined,
                      }));
                    }}
                    onSearchChange={(value) => {
                      setLocation(value);
                      setSelectedLocation(null);
                    }}
                    options={locationSelectOptions}
                    placeholder={t("locationPlaceholder")}
                    sanitizeSearchInput={sanitizeOlxLocationInput}
                    searchPlaceholder={t("locationPlaceholder")}
                    value={selectedLocationValue}
                  />
                  {locationsQuery.isFetching ? (
                    <p className="text-text-placeholder text-xs leading-5">
                      {t("locationSearching")}
                    </p>
                  ) : null}
                  {errorText("location")}
                </div>
                <Dropdown
                  label={t("employmentType")}
                  onChange={setEmploymentType}
                  options={[
                    { value: "perm", label: t("employmentPermanent") },
                    { value: "temp", label: t("employmentTemporary") },
                  ]}
                  value={employmentType}
                />
                <Dropdown
                  label={t("schedule")}
                  onChange={setSchedule}
                  options={[
                    { value: "full", label: t("scheduleFull") },
                    { value: "part", label: t("schedulePart") },
                  ]}
                  value={schedule}
                />
              </div>
            </ClosableSection>
          </div>

          <div className="surface-card p-5 sm:p-6">
            <ClosableSection title={t("salaryAndContact")}>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <Input
                  inputMode="numeric"
                  label={t("salaryFrom")}
                  onChange={(event) =>
                    setSalaryFrom(
                      formatNumberWithSpaces(event.currentTarget.value),
                    )
                  }
                  value={salaryFrom}
                />
                <Input
                  inputMode="numeric"
                  label={t("salaryTo")}
                  onChange={(event) =>
                    setSalaryTo(
                      formatNumberWithSpaces(event.currentTarget.value),
                    )
                  }
                  value={salaryTo}
                />
                <Dropdown
                  label={t("currency")}
                  onChange={(value) =>
                    setSalaryCurrency(value === "USD" ? "USD" : "UZS")
                  }
                  options={[
                    { value: "UZS", label: "UZS" },
                    { value: "USD", label: "USD" },
                  ]}
                  value={salaryCurrency}
                />
                <Input
                  label={t("contactName")}
                  onChange={(event) =>
                    setContactName(event.currentTarget.value)
                  }
                  value={contactName}
                />
                {errorText("contactName")}
                <div className="flex flex-col gap-1">
                  <Input
                    aria-describedby="olx-contact-phone-error"
                    aria-invalid={Boolean(errors.contactPhone)}
                    autoComplete="tel"
                    id="olx-contact-phone"
                    inputMode="tel"
                    label={t("contactPhone")}
                    maxLength={17}
                    onChange={(event) => {
                      setContactPhone(
                        formatOlxUzPhoneInput(event.currentTarget.value),
                      );
                      if (errors.contactPhone) {
                        setErrors((current) => ({
                          ...current,
                          contactPhone: undefined,
                        }));
                      }
                    }}
                    pattern={OLX_UZ_PHONE_HTML_PATTERN}
                    type="tel"
                    value={contactPhone}
                  />
                  <div id="olx-contact-phone-error">
                    {errorText("contactPhone")}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-col items-start gap-3">
                {[
                  [
                    salaryNegotiable,
                    setSalaryNegotiable,
                    t("salaryNegotiable"),
                  ],
                  [remoteWork, setRemoteWork, t("remoteWork")],
                  [
                    onlineRecruitment,
                    setOnlineRecruitment,
                    t("onlineRecruitment"),
                  ],
                ].map(([checked, setter, label]) => (
                  <div
                    className="flex items-center gap-2 text-sm text-text-heading"
                    key={String(label)}
                  >
                    <Checkbox
                      checked={Boolean(checked)}
                      onChange={() =>
                        (setter as (value: boolean) => void)(!checked)
                      }
                    />
                    <span>{String(label)}</span>
                  </div>
                ))}
              </div>
            </ClosableSection>
          </div>
        </div>

        <div className="sticky bottom-0 z-10 mt-6 border-border-input border-t bg-bg-frosted py-4 backdrop-blur-xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-h-5">{errorText("_form")}</div>
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
              {!alreadyPublished ? (
                <button
                  className="ui-button ui-button-primary"
                  disabled={isSubmitting || !connected || !serviceAvailable}
                  onClick={() => {
                    if (validate()) setIsConfirmOpen(true);
                  }}
                  type="button"
                >
                  {t("publish")}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <PublicationConfirmationModal
        confirmLabel={t("publish")}
        description={t("confirmDescription")}
        isOpen={isConfirmOpen}
        isPending={isSubmitting}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={() => void publishOlx()}
        onReject={() => setIsConfirmOpen(false)}
        rejectLabel={commonT("cancel")}
        title={t("confirmTitle")}
      />
    </main>
  );
}
