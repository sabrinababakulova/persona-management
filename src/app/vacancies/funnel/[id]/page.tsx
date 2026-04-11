"use client";

import { useParams } from "next/navigation";
import { Breadcrumbs } from "~/app/_components/Breadcrumbs";
import { api } from "~/trpc/react";

export default function VacancyFunnelPage() {
  const { id } = useParams() as { id: string };
  const { data, isLoading } = api.vacancies.getVacancyFunnel.useQuery(
    { id },
    { enabled: Boolean(id) },
  );

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-light">
        <div className="text-gray-600">Загрузка...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-light">
        <div className="text-gray-600">Воронка вакансии не найдена</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-white px-6 pt-8 pb-8">
      <div className="mx-auto flex w-full max-w-[960px] flex-col gap-6">
        <Breadcrumbs
          label={`${data.title} / Воронка`}
          rootHref="/vacancies"
          rootLabel="Вакансии"
        />

        <section className="rounded-[8px] border border-border-input bg-white p-6">
          <h1 className="font-semibold text-[24px] text-text-heading leading-none">
            Кандидаты по вакансии {data.title}
          </h1>

          <div className="mt-6">
            {data.candidates.length === 0 ? (
              <div className="text-[14px] text-text-secondary">
                По этой вакансии пока нет кандидатов.
              </div>
            ) : (
              <ul className="space-y-3">
                {data.candidates.map((candidate) => (
                  <li
                    className="rounded-[6px] border border-border-input bg-bg-input px-4 py-3"
                    key={candidate.id}
                  >
                    <div className="font-medium text-[14px] text-text-heading">
                      {candidate.fullName}
                    </div>
                    <div className="mt-1 text-[13px] text-text-secondary">
                      ID: {candidate.id}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
