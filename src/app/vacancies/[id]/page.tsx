"use client";

import { useParams } from "next/navigation";
import { useMemo } from "react";
import { api, type RouterOutputs } from "~/trpc/react";
import {
  CreateVacancyForm,
  type CreateVacancyFormInitialData,
} from "../create/create-vacancy-form";
import { HhVacancyPreview } from "./hh-vacancy-preview";

type VacancyDetail = NonNullable<RouterOutputs["vacancies"]["get"]>;

/**
 * Maps a vacancy fetched from `vacancies.get` onto the {@link CreateVacancyForm} field names.
 *
 * The schema now stores hh.uz-shaped fields directly, so this mapping is mostly 1:1. Numeric
 * salary values are formatted with thousands separators for display in the form's text inputs.
 */
function buildInitialData(
  vacancy: VacancyDetail,
): CreateVacancyFormInitialData {
  const formatter = new Intl.NumberFormat("ru-RU");
  return {
    name: vacancy.title,
    areaId: vacancy.areaId ?? "",
    employmentId: vacancy.employmentId ?? "",
    scheduleId: vacancy.scheduleId ?? "",
    experienceId: vacancy.experienceId ?? "",
    professionalRoleId: vacancy.professionalRoleId ?? "",
    billingTypeId: vacancy.billingTypeId ?? "",
    salaryFrom:
      vacancy.salaryFrom !== undefined && vacancy.salaryFrom !== null
        ? formatter.format(vacancy.salaryFrom)
        : "",
    salaryTo:
      vacancy.salaryTo !== undefined && vacancy.salaryTo !== null
        ? formatter.format(vacancy.salaryTo)
        : "",
    salaryCurrency: vacancy.salaryCurrency ?? "UZS",
    descriptionHtml: vacancy.descriptionHtml ?? "",
    contactPhone: vacancy.contactPhone ?? "",
  };
}

/**
 * Vacancy detail page.
 *
 * Renders the shared {@link CreateVacancyForm} in edit mode, prefilled from `vacancies.get`.
 * The form's preview tab is overridden to show {@link HhVacancyPreview} when the vacancy is
 * linked to hh.uz; otherwise it shows a "not yet published" placeholder.
 */
export default function VacancyDetailPage() {
  const { id: vacancyId } = useParams() as { id: string };

  const { data: vacancy, isLoading } = api.vacancies.get.useQuery(
    { id: vacancyId },
    { enabled: Boolean(vacancyId) },
  );

  const initialData = useMemo(
    () => (vacancy ? buildInitialData(vacancy) : undefined),
    [vacancy],
  );

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-light">
        <div className="text-text-secondary">Загрузка...</div>
      </div>
    );
  }

  if (!vacancy) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-light">
        <div className="text-text-secondary">Вакансия не найдена</div>
      </div>
    );
  }

  const hasHhLink = vacancy.source === "hh.uz" || Boolean(vacancy.hhVacancyId);
  const hasTelegramPosting = vacancy.publications.some(
    (publication) =>
      publication.isActive &&
      publication.sources.some(
        (source) => source.platform === "telegram" && Boolean(source.keyword),
      ),
  );
  // Archived hh.uz vacancies are read-only: hh.uz only accepts edits to active vacancies, so
  // we lock the form and tell the user how to unblock it.
  const isArchivedHh = hasHhLink && vacancy.status === "archive";

  const previewContent = hasHhLink ? (
    <HhVacancyPreview vacancyId={vacancyId} />
  ) : (
    <section className="rounded-[8px] border border-border-input bg-bg-input p-5">
      <div className="font-bold text-[18px] text-text-heading">hh.uz</div>
      <div className="mt-2 text-[14px] text-text-secondary">
        Эта вакансия не опубликована на hh.uz. Опубликуйте её или укажите ID
        hh.uz в админ-панели Directus, чтобы увидеть предпросмотр.
      </div>
    </section>
  );

  const archivedBanner = isArchivedHh ? (
    <section
      aria-live="polite"
      className="flex items-start gap-3 rounded-[8px] border border-status-outline-border bg-status-neutral-bg px-4 py-3 text-[14px] text-text-heading"
      role="alert"
    >
      <span
        aria-hidden="true"
        className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-text-heading font-bold text-[12px] text-bg-light leading-none"
      >
        !
      </span>
      <div>
        <p className="font-semibold leading-[1.4]">Эта вакансия в архиве.</p>
        <p className="mt-1 text-text-secondary leading-[1.4]">
          Чтобы внести изменения, переведите её в активный статус.
        </p>
      </div>
    </section>
  ) : null;
  const telegramBadge = hasTelegramPosting ? (
    <div>
      <span className="inline-flex h-8 items-center rounded-full border border-[#0088cc]/30 bg-[#0088cc]/10 px-3 font-semibold text-[#0088cc] text-[13px] leading-none">
        posted on telegram
      </span>
    </div>
  ) : null;
  const bannerContent =
    archivedBanner || telegramBadge ? (
      <div className="flex flex-col gap-3">
        {telegramBadge}
        {archivedBanner}
      </div>
    ) : null;

  return (
    <main className="h-full bg-bg-light">
      <CreateVacancyForm
        bannerContent={bannerContent}
        breadcrumbLabel={vacancy.title}
        initialData={initialData}
        pageHeading={vacancy.title || "Редактирование вакансии"}
        previewContent={previewContent}
        readOnly={isArchivedHh}
        vacancyId={vacancyId}
      />
    </main>
  );
}
