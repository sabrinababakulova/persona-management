"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Breadcrumbs } from "~/app/_components/Breadcrumbs";
import { Checkbox } from "~/app/_components/checkbox";
import { ClosableSection } from "~/app/_components/closable-section";
import { Dropdown } from "~/app/_components/dropdown";
import { Input } from "~/app/_components/input";
import {
  FeedbackPresence,
  LoadingButtonContent,
} from "~/app/_components/motion-system";
import { RichTextEditor } from "~/app/_components/rich-text-editor";
import {
  formatOlxUzPhone,
  normalizeOlxUzPhone,
  OLX_UZ_PHONE_EXAMPLE,
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
  const configQuery = api.vacancies.getOlxBrowserConfig.useQuery();

  const [title, setTitle] = useState("");
  const [descriptionHtml, setDescriptionHtml] = useState("");
  const [categoryPath, setCategoryPath] = useState("Работа > Вакансии");
  const [location, setLocation] = useState("");
  const [district, setDistrict] = useState("");
  const [employmentType, setEmploymentType] = useState("");
  const [schedule, setSchedule] = useState("");
  const [experience, setExperience] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [salaryFrom, setSalaryFrom] = useState("");
  const [salaryTo, setSalaryTo] = useState("");
  const [salaryCurrency, setSalaryCurrency] = useState<"UZS" | "USD">("UZS");
  const [salaryNegotiable, setSalaryNegotiable] = useState(false);
  const [remoteWork, setRemoteWork] = useState(false);
  const [onlineRecruitment, setOnlineRecruitment] = useState(false);
  const [errors, setErrors] = useState<OlxErrors>({});
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  useEffect(() => {
    const vacancy = vacancyQuery.data;
    const hydrationKey = effectivePublicationId || vacancyId;
    if (!vacancy || hydratedFor.current === hydrationKey) {
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
    setContactPhone(vacancy.contactPhone ?? "");

    const meta = vacancy.olxBrowserMeta;
    if (meta) {
      setCategoryPath(meta.categoryPath.join(" > "));
      setLocation(meta.location);
      setDistrict(meta.district ?? "");
      setEmploymentType(meta.employmentType ?? "");
      setSchedule(meta.schedule ?? "");
      setExperience(meta.experience ?? "");
      setContactName(meta.contactName ?? "");
      setContactPhone(meta.contactPhone ?? vacancy.contactPhone ?? "");
      setSalaryNegotiable(meta.salaryNegotiable);
      setRemoteWork(meta.remoteWork);
      setOnlineRecruitment(meta.onlineRecruitment);
    }
  }, [effectivePublicationId, vacancyId, vacancyQuery.data]);

  const createPublication = api.vacancies.create.useMutation();
  const updatePublication = api.vacancies.update.useMutation();
  const runBrowser = api.vacancies.publishOlxBrowser.useMutation();

  const isSubmitting =
    createPublication.isPending ||
    updatePublication.isPending ||
    runBrowser.isPending;
  const existingAdvertUrl = vacancyQuery.data?.olxAdvertUrl ?? null;
  const normalizedContactPhone = contactPhone.trim()
    ? normalizeOlxUzPhone(contactPhone)
    : null;

  const buildMeta = () => ({
    categoryPath: categoryPath
      .split(">")
      .map((segment) => segment.trim())
      .filter(Boolean),
    location: location.trim(),
    ...(district.trim() ? { district: district.trim() } : {}),
    ...(employmentType.trim() ? { employmentType: employmentType.trim() } : {}),
    ...(schedule.trim() ? { schedule: schedule.trim() } : {}),
    ...(experience.trim() ? { experience: experience.trim() } : {}),
    ...(contactName.trim() ? { contactName: contactName.trim() } : {}),
    ...(normalizedContactPhone ? { contactPhone: normalizedContactPhone } : {}),
    salaryNegotiable,
    remoteWork,
    onlineRecruitment,
  });

  const validate = (): boolean => {
    const next: OlxErrors = {};
    if (!title.trim()) next.title = t("titleRequired");
    if (!hasVisibleText(descriptionHtml)) {
      next.description = t("descriptionRequired");
    }
    if (buildMeta().categoryPath.length === 0) {
      next.category = t("categoryRequired");
    }
    if (!location.trim()) next.location = t("locationRequired");
    if (contactPhone.trim() && !normalizedContactPhone) {
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

  const executeBrowserAction = async (dryRun: boolean) => {
    if (!validate()) return;
    setFeedback(null);
    setErrors({});

    try {
      const publicationId = await saveLocalPublication();
      const result = await runBrowser.mutateAsync({
        id: publicationId,
        dryRun,
      });
      await Promise.all([
        utils.vacancies.get.invalidate({ id: vacancyId }),
        utils.vacancies.get.invalidate({ id: publicationId }),
        utils.vacancies.list.invalidate(),
        utils.vacancies.listPublications.invalidate({
          parentVacancyId: vacancyId,
        }),
      ]);

      if (result.mode === "preview") {
        setFeedback(t("previewSuccess"));
        if (!pubId) {
          router.replace(
            `/vacancies/${vacancyId}/publications/olx.uz/${publicationId}`,
          );
        }
        return;
      }

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
  const browserAvailable = configQuery.data?.browserAvailable ?? false;

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

        {!browserAvailable || !connected ? (
          <div className="mb-5 rounded-lg border border-border-input bg-bg-input px-4 py-3 text-sm leading-5">
            <p className="font-medium text-text-heading">
              {!browserAvailable ? t("browserUnavailable") : t("notConnected")}
            </p>
            <Link
              className="mt-1 inline-block text-primary-blue hover:underline"
              href="/my-profile?section=company-settings"
            >
              {t("openSettings")}
            </Link>
          </div>
        ) : null}

        {existingAdvertUrl ? (
          <div className="mb-5 rounded-lg border border-border-input bg-bg-input px-4 py-3 text-sm leading-5">
            <p className="font-medium text-text-heading">
              {t("alreadyPublished")}
            </p>
            <p className="mt-1 text-text-secondary">
              {t("alreadyPublishedHint")}
            </p>
            <a
              className="mt-2 inline-block text-primary-blue hover:underline"
              href={existingAdvertUrl}
              rel="noopener noreferrer"
              target="_blank"
            >
              {t("openAdvert")}
            </a>
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
                <p className="text-text-placeholder text-xs leading-5">
                  {t("plainTextHint")}
                </p>
                {errorText("description")}
              </div>
            </ClosableSection>
          </div>

          <div className="surface-card p-5 sm:p-6">
            <ClosableSection title={t("placement")}>
              <p className="text-sm text-text-secondary leading-5">
                {t("labelsHint")}
              </p>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Input
                    label={t("categoryPath")}
                    onChange={(event) =>
                      setCategoryPath(event.currentTarget.value)
                    }
                    placeholder={t("categoryPathPlaceholder")}
                    value={categoryPath}
                  />
                  {errorText("category")}
                </div>
                <div className="flex flex-col gap-2">
                  <Input
                    label={t("location")}
                    onChange={(event) => setLocation(event.currentTarget.value)}
                    placeholder={t("locationPlaceholder")}
                    value={location}
                  />
                  {errorText("location")}
                </div>
                <Input
                  label={t("district")}
                  onChange={(event) => setDistrict(event.currentTarget.value)}
                  placeholder={t("optionalExactLabel")}
                  value={district}
                />
                <Input
                  label={t("employmentType")}
                  onChange={(event) =>
                    setEmploymentType(event.currentTarget.value)
                  }
                  placeholder={t("employmentPlaceholder")}
                  value={employmentType}
                />
                <Input
                  label={t("schedule")}
                  onChange={(event) => setSchedule(event.currentTarget.value)}
                  placeholder={t("schedulePlaceholder")}
                  value={schedule}
                />
                <Input
                  label={t("experience")}
                  onChange={(event) => setExperience(event.currentTarget.value)}
                  placeholder={t("experiencePlaceholder")}
                  value={experience}
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
                <div className="flex flex-col gap-1">
                  <Input
                    aria-describedby="olx-contact-phone-hint olx-contact-phone-error"
                    aria-invalid={Boolean(errors.contactPhone)}
                    autoComplete="tel"
                    id="olx-contact-phone"
                    inputMode="tel"
                    label={t("contactPhone")}
                    maxLength={30}
                    onBlur={() => {
                      const formatted = formatOlxUzPhone(contactPhone);
                      if (formatted) setContactPhone(formatted);
                    }}
                    onChange={(event) => {
                      setContactPhone(event.currentTarget.value);
                      if (errors.contactPhone) {
                        setErrors((current) => ({
                          ...current,
                          contactPhone: undefined,
                        }));
                      }
                    }}
                    placeholder={OLX_UZ_PHONE_EXAMPLE}
                    type="tel"
                    value={contactPhone}
                  />
                  <p
                    className="text-text-placeholder text-xs leading-5"
                    id="olx-contact-phone-hint"
                  >
                    {t("contactPhoneHint")}
                  </p>
                  <div id="olx-contact-phone-error">
                    {errorText("contactPhone")}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
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
            <div className="min-h-5">
              {errorText("_form")}
              <FeedbackPresence show={Boolean(feedback)}>
                <p className="text-success-green text-xs leading-5">
                  {feedback}
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
                className="ui-button ui-button-secondary"
                disabled={isSubmitting || !connected || !browserAvailable}
                onClick={() => void executeBrowserAction(true)}
                type="button"
              >
                <LoadingButtonContent
                  isLoading={runBrowser.isPending}
                  label={t("preview")}
                  loadingLabel={t("previewing")}
                />
              </button>
              {!existingAdvertUrl ? (
                <button
                  className="ui-button ui-button-primary"
                  disabled={isSubmitting || !connected || !browserAvailable}
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
        onConfirm={() => void executeBrowserAction(false)}
        onReject={() => setIsConfirmOpen(false)}
        rejectLabel={commonT("cancel")}
        title={t("confirmTitle")}
      />
    </main>
  );
}
