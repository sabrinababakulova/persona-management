import { api, HydrateClient } from "~/trpc/server";
import { CreateVacancyForm } from "./create-vacancy-form";

export default async function CreateVacancyPage() {
  await Promise.all([
    api.lookups.getVacancyCreateOptions.prefetch().catch(() => null),
    api.vacancies.isTelegramEnabled.prefetch().catch(() => null),
  ]);

  return (
    <HydrateClient>
      <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-bg-light">
        <CreateVacancyForm />
      </main>
    </HydrateClient>
  );
}
