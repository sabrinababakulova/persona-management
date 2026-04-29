import { Suspense } from "react";
import { api, HydrateClient } from "~/trpc/server";
import { CreateVacancyForm } from "./create-vacancy-form";

export default async function CreateVacancyPage() {
  await Promise.all([
    api.lookups.getVacancyCreateOptions.prefetch().catch(() => null),
    api.vacancies.getTelegramConfig.prefetch().catch(() => null),
  ]);

  return (
    <HydrateClient>
      <main className="h-full bg-bg-light">
        <Suspense fallback={null}>
          <CreateVacancyForm />
        </Suspense>
      </main>
    </HydrateClient>
  );
}
