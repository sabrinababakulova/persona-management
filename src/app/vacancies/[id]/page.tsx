"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { Breadcrumbs } from "~/app/_components/Breadcrumbs";
import { SideMenu } from "~/app/_components/sideMenu";
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

  const {
    data: vacancyLookups,
    isError: isLookupsError,
    isLoading: isLookupsLoading,
    refetch: refetchLookups,
  } = api.lookups.getVacancyCreateOptions.useQuery();

  const { data: vacancy, isLoading } = api.vacancies.getVacancyById.useQuery(
    { id: vacancyId },
    { enabled: Boolean(vacancyId) },
  );

  const activeSection = SIDE_MENU_ITEMS.find(
    (item) => item.id === activeSectionId,
  );

  if (isLoading || isLookupsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-light">
        <div className="text-text-secondary">Загрузка...</div>
      </div>
    );
  }

  if (isLookupsError || !vacancyLookups) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-light px-4">
        <div className="w-full max-w-[460px] rounded-[8px] border border-danger-red-bg bg-danger-red-bg p-5 text-danger-red">
          <p className="mb-4 text-[14px]">
            Не удалось загрузить справочники из базы данных.
          </p>
          <button
            className="rounded-[6px] bg-primary-blue px-4 py-2 text-[14px] text-bg-light hover:bg-primary-blue-hover"
            onClick={() => void refetchLookups()}
            type="button"
          >
            Повторить
          </button>
        </div>
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

  return (
    <main className="h-full bg-bg-light">
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
              <>
                {vacancy.source === "hh.uz" && (
                  <div className="mt-6 rounded-[6px] border border-border-input bg-bg-input px-4 py-3 text-[14px] text-text-secondary">
                    Данные загружены из hh.uz. Изменения названия, описания,
                    зарплаты и статуса будут синхронизированы с hh.uz.
                  </div>
                )}

                <VacancyDescription
                  city={vacancy.city}
                  comments={vacancy.comments}
                  companyDescription={vacancy.companyDescription}
                  level={vacancy.level}
                  salaryCurrency={vacancy.salaryCurrency}
                  salaryExpectation={vacancy.salaryExpectation}
                  status={vacancy.status}
                  tasks={vacancy.tasks}
                  team={vacancy.team}
                  title={vacancy.title}
                  vacancyId={vacancyId}
                  vacancyLookups={vacancyLookups}
                  workScheduleEnd={vacancy.workScheduleEnd}
                  workScheduleStart={vacancy.workScheduleStart}
                  workType={vacancy.workType}
                />
              </>
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
