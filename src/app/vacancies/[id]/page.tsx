"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { Breadcrumbs } from "~/app/_components/Breadcrumbs";
import { SideMenu } from "~/app/_components/sideMenu";
import { DEFAULT_VACANCY_LOOKUPS } from "~/shared/vacancy-lookups";
import { api } from "~/trpc/react";
import { VacancyDescription } from "../components";

const SIDE_MENU_ITEMS = [
  { id: "description", label: "Описание вакансии" },
  { id: "publications", label: "Публикации" },
  { id: "preview", label: "Предпросмотр" },
] as const;

export default function VacancyDetailPage() {
  const { id: vacancyId } = useParams() as { id: string };
  const [activeSectionId, setActiveSectionId] = useState<string>(
    SIDE_MENU_ITEMS[0].id,
  );

  const { data: vacancyLookupsData } =
    api.lookups.getVacancyCreateOptions.useQuery();
  const vacancyLookups = vacancyLookupsData ?? DEFAULT_VACANCY_LOOKUPS;

  const { data: vacancy, isLoading } = api.vacancies.getVacancyById.useQuery(
    { id: vacancyId },
    { enabled: Boolean(vacancyId) },
  );

  const activeSection = SIDE_MENU_ITEMS.find(
    (item) => item.id === activeSectionId,
  );

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-light">
        <div className="text-gray-600">Загрузка...</div>
      </div>
    );
  }

  if (!vacancy) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-light">
        <div className="text-gray-600">Вакансия не найдена</div>
      </div>
    );
  }

  return (
    <main className="h-full bg-white">
      <div className="flex w-full gap-[64px] px-6 pt-8 pb-8">
        <SideMenu
          activeId={activeSectionId}
          items={SIDE_MENU_ITEMS.map((item) => ({ ...item }))}
          onSelect={setActiveSectionId}
        />

        <section className="flex flex-3 flex-col">
          <div className="w-full max-w-[560px]">
            <Breadcrumbs
              label={vacancy.title}
              rootHref="/vacancies"
              rootLabel="Вакансии"
            />

            {activeSectionId === "description" ? (
              <VacancyDescription
                city={vacancy.city}
                companyDescription={vacancy.companyDescription}
                level={vacancy.level}
                status={vacancy.status}
                tasks={vacancy.tasks}
                team={vacancy.team}
                title={vacancy.title}
                vacancyId={vacancyId}
                vacancyLookups={vacancyLookups}
                workType={vacancy.workType}
              />
            ) : (
              <div className="mt-12 rounded-[6px] border border-border-input bg-bg-input px-4 py-6 text-[14px] text-text-secondary">
                Секция "{activeSection?.label}" будет доступна позже.
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
