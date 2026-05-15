"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { SideMenu } from "~/app/_components/sideMenu";
import { SIDE_MENU_ITEMS } from "~/shared/vacancy-side-menu";
import { api, type RouterOutputs } from "~/trpc/react";
import {
  CreateVacancyForm,
  type CreateVacancyFormInitialData,
} from "../create/create-vacancy-form";
import { PreviewStep } from "./preview-step";
import { PublicationsTable } from "./publications-table";

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
 * The form's preview tab points the user at `/vacancies/<id>/publications/hh.uz` when the
 * vacancy is linked to hh.uz; otherwise it shows a "not yet published" placeholder.
 */
export default function VacancyDetailPage() {
  const { id: vacancyId } = useParams() as { id: string };
  const router = useRouter();
  const searchParams = useSearchParams();

  const { data: vacancy, isLoading } = api.vacancies.get.useQuery(
    { id: vacancyId },
    { enabled: Boolean(vacancyId) },
  );

  const initialData = useMemo(
    () => (vacancy ? buildInitialData(vacancy) : undefined),
    [vacancy],
  );
  const stepParam = searchParams.get("step");
  const normalizedStepParam =
    stepParam === "publication" ? "publications" : stepParam;
  const activeSectionId =
    normalizedStepParam &&
    SIDE_MENU_ITEMS.some((item) => item.id === normalizedStepParam)
      ? normalizedStepParam
      : SIDE_MENU_ITEMS[0].id;

  const goToStep = (id: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("step", id);
    router.push(`/vacancies/${vacancyId}?${params.toString()}`);
  };

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
  // Archived hh.uz vacancies are read-only: hh.uz only accepts edits to active vacancies, so
  // we lock the form and tell the user how to unblock it.
  const isArchivedHh =
    vacancy.source === "hh.uz" && vacancy.status === "archive";

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

  return (
    <main className="h-full bg-bg-light">
      <div className="relative w-full">
        <div className="flex w-full gap-16 px-6 pt-8 pb-8">
          <SideMenu
            activeId={activeSectionId}
            items={SIDE_MENU_ITEMS.map((item) => ({ ...item }))}
            onSelect={goToStep}
          />

          <section className="flex flex-3 flex-col">
            {activeSectionId === "description" ? (
              <CreateVacancyForm
                bannerContent={archivedBanner}
                breadcrumbLabel={vacancy.title}
                initialData={initialData}
                pageHeading={vacancy.title || "Редактирование вакансии"}
                readOnly={isArchivedHh}
                vacancyId={vacancyId}
              />
            ) : activeSectionId === "publications" ? (
              <div className="w-full max-w-[900px]">
                <PublicationsTable />
              </div>
            ) : (
              <div className="w-full max-w-225">
                <h1 className="mb-6 font-bold text-[44px] text-text-heading leading-none tracking-[-0.64px]">
                  Предпросмотр
                </h1>
                <PreviewStep />
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
