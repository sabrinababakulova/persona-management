"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { useMemo } from "react";
import { ChevronDownIcon } from "~/app/_components/icons";
import {
  FeedbackPresence,
  LoadingState,
} from "~/app/_components/motion-system";
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
  formatNumber: (value: number) => string,
): CreateVacancyFormInitialData {
  return {
    name: vacancy.title,
    salaryFrom:
      vacancy.salaryFrom !== undefined && vacancy.salaryFrom !== null
        ? formatNumber(vacancy.salaryFrom)
        : "",
    salaryTo:
      vacancy.salaryTo !== undefined && vacancy.salaryTo !== null
        ? formatNumber(vacancy.salaryTo)
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
  const format = useFormatter();
  const t = useTranslations("VacancyDetail");
  const vacancyFormT = useTranslations("VacancyForm");
  const { id: vacancyId } = useParams() as { id: string };
  const router = useRouter();
  const searchParams = useSearchParams();
  const utils = api.useUtils();

  const { data: vacancy, isLoading } = api.vacancies.get.useQuery(
    { id: vacancyId },
    { enabled: Boolean(vacancyId) },
  );

  const restoreFromArchive = api.vacancies.update.useMutation({
    onSuccess: () => {
      void utils.vacancies.get.invalidate({ id: vacancyId });
      void utils.vacancies.list.invalidate();
    },
  });

  const initialData = useMemo(
    () =>
      vacancy
        ? buildInitialData(vacancy, (value) => format.number(value))
        : undefined,
    [format, vacancy],
  );
  const sideMenuItems = useMemo(
    () => [
      { id: "description", label: t("descriptionMenu") },
      { id: "publications", label: t("publicationsMenu") },
      { id: "preview", label: t("previewMenu") },
    ],
    [t],
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
      <div className="flex h-full min-h-0 items-center justify-center bg-bg-canvas">
        <LoadingState label={t("loading")} />
      </div>
    );
  }

  if (!vacancy) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center bg-bg-canvas">
        <FeedbackPresence show>
          <div className="rounded-xl border border-danger-red/20 bg-danger-red-bg px-5 py-4 text-danger-red text-sm">
            {t("notFound")}
          </div>
        </FeedbackPresence>
      </div>
    );
  }
  // Archived hh.uz vacancies are read-only: hh.uz only accepts edits to active vacancies, so
  // we lock the form and tell the user how to unblock it. Synced archived stubs live in our
  // own table (source === "local") but still carry `hhVacancyId`, so we lock those too.
  const isArchivedHh =
    vacancy.status === "archive" && Boolean(vacancy.hhVacancyId);

  const handleStatusChange = (nextStatus: string) => {
    if (nextStatus === vacancy.status || restoreFromArchive.isPending) {
      return;
    }
    if (nextStatus === "active") {
      restoreFromArchive.mutate({ id: vacancyId, status: "active" });
    }
  };

  const archivedBanner = isArchivedHh ? (
    <section
      aria-live="polite"
      className="flex flex-col gap-3 rounded-xl border border-status-outline-border bg-status-neutral-bg px-4 py-3 text-sm text-text-heading sm:flex-row sm:items-start sm:justify-between"
      role="alert"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-text-heading font-bold text-bg-light text-xs leading-none"
        >
          !
        </span>
        <div>
          <p className="font-semibold leading-[1.4]">{t("archivedTitle")}</p>
          <p className="mt-1 text-text-secondary leading-[1.4]">
            {t("archivedDescription")}
          </p>
          {restoreFromArchive.error && (
            <p className="mt-2 text-accent-red leading-[1.4]">
              {restoreFromArchive.error.message}
            </p>
          )}
        </div>
      </div>
      <label className="flex shrink-0 items-center gap-2 text-text-secondary text-xs uppercase">
        <span className="sr-only">{t("status")}</span>
        <div className="relative inline-flex min-w-[140px] items-center overflow-hidden rounded-lg border border-status-outline-border bg-bg-light">
          <select
            aria-label={t("status")}
            className="h-[36px] w-full appearance-none bg-transparent px-3 pr-8 font-semibold text-text-heading text-xs uppercase leading-none disabled:cursor-not-allowed disabled:opacity-70"
            disabled={restoreFromArchive.isPending}
            onChange={(event) => handleStatusChange(event.target.value)}
            value={vacancy.status ?? "archive"}
          >
            <option value="archive">{t("archived")}</option>
            <option value="active">{t("active")}</option>
          </select>
          <ChevronDownIcon className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-text-heading" />
        </div>
      </label>
    </section>
  ) : null;

  return (
    <main className="h-full bg-bg-canvas">
      <div className="app-page flex flex-col gap-5 lg:flex-row lg:gap-8">
        <SideMenu
          activeId={activeSectionId}
          items={sideMenuItems}
          onSelect={goToStep}
        />

        <section className="min-w-0 flex-1">
          {activeSectionId === "description" ? (
            <CreateVacancyForm
              bannerContent={archivedBanner}
              breadcrumbLabel={vacancy.title}
              initialData={initialData}
              pageHeading={vacancy.title || vacancyFormT("editTitle")}
              readOnly={isArchivedHh}
              vacancyId={vacancyId}
            />
          ) : activeSectionId === "publications" ? (
            <div className="w-full max-w-225">
              <PublicationsTable />
            </div>
          ) : (
            <div className="w-full max-w-225">
              <h1 className="page-title mb-5">{t("preview")}</h1>
              <PreviewStep />
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
