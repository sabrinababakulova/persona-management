"use client";

import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ClosableSection } from "~/app/_components/closable-section";
import { SkeletonBlock } from "~/app/_components/page-skeleton";
import { api } from "~/trpc/react";

export function PreviewStep() {
  const t = useTranslations("VacancyDetail");
  const { id: parentVacancyId } = useParams() as { id: string };

  const { data: publications, isLoading } =
    api.vacancies.listPublications.useQuery(
      { parentVacancyId },
      { enabled: Boolean(parentVacancyId) },
    );
  const { data: parentVacancy } = api.vacancies.get.useQuery(
    { id: parentVacancyId },
    { enabled: Boolean(parentVacancyId) },
  );

  if (isLoading) {
    return (
      <div aria-busy="true" className="surface-card space-y-4 p-6">
        <SkeletonBlock className="h-6 w-48" />
        <SkeletonBlock className="h-4 w-full rounded-md" />
        <SkeletonBlock className="h-4 w-5/6 rounded-md" />
        <SkeletonBlock className="h-32 w-full" />
      </div>
    );
  }

  const activePublications =
    publications?.filter((publication) => publication.isActive) ?? [];

  if (activePublications.length === 0) {
    return (
      <div className="rounded-lg border border-border-input bg-bg-light p-4 text-sm text-text-secondary leading-[1.4] lg:p-6">
        {t("noActivePublications")}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg border border-border-input bg-bg-light p-4 lg:p-6">
        <ClosableSection title={t("main")}>
          <p>{parentVacancy?.title}</p>
          <div
            className="text-sm text-text-secondary leading-[1.4]"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: descriptionHtml is authored by the company in the editor
            dangerouslySetInnerHTML={{
              __html: parentVacancy?.descriptionHtml ?? "",
            }}
          />
        </ClosableSection>
      </div>
      {activePublications.map((publication) => (
        <div
          className="rounded-lg border border-border-input bg-bg-light p-4 lg:p-6"
          key={publication.id}
        >
          <ClosableSection
            title={t("mainFor", {
              destination: publication.destination ?? "",
            }).trim()}
          >
            <p>{publication.title}</p>
            <div
              className="text-sm text-text-secondary leading-[1.4]"
              // biome-ignore lint/security/noDangerouslySetInnerHtml: descriptionHtml is authored by the company in the editor
              dangerouslySetInnerHTML={{
                __html: publication.descriptionHtml ?? "",
              }}
            />
          </ClosableSection>
        </div>
      ))}
    </div>
  );
}
