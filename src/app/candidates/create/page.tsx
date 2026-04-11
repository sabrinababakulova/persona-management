import { api, HydrateClient } from "~/trpc/server";
import { CreateCandidateForm } from "./create-candidate-form";

export default async function CreateCandidatePage() {
  // Prefetch lookup data on the server, but don't fail the page if lookups are unavailable.
  await api.lookups.getCandidateCreateOptions.prefetch().catch(() => null);

  return (
    <HydrateClient>
      <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-bg-light">
        <CreateCandidateForm />
      </main>
    </HydrateClient>
  );
}
