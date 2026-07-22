"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { SideMenu } from "~/app/_components/sideMenu";
import { SIDE_MENU_ITEMS } from "~/shared/vacancy-side-menu";
import { CreateVacancyForm } from "./create-vacancy-form";

function CreateVacancyPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const goToStep = (id: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("step", id);
    router.push(`/vacancies/create?${params.toString()}`);
  };

  const goToPublications = (createdVacancyId: string) => {
    router.push(`/vacancies/${createdVacancyId}?step=publications`);
  };

  return (
    <main className="h-full bg-bg-canvas">
      <div className="app-page flex flex-col gap-5 lg:flex-row lg:gap-8">
        <SideMenu
          activeId={SIDE_MENU_ITEMS[0].id}
          items={SIDE_MENU_ITEMS.map((item) => ({
            ...item,
            disabled: item.id !== "description",
          }))}
          onSelect={goToStep}
        />

        <section className="min-w-0 flex-1">
          <CreateVacancyForm onSaved={goToPublications} />
        </section>
      </div>
    </main>
  );
}

export default function CreateVacancyPage() {
  return (
    <Suspense fallback={null}>
      <CreateVacancyPageContent />
    </Suspense>
  );
}
