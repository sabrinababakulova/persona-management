import { api, HydrateClient } from "~/trpc/server";
import { CreateCandidateForm } from "./create-candidate-form";

export default async function CreateCandidatePage() {
  // Prefetch lookup data on the server, but don't fail the page if lookups are unavailable.
  await api.lookups.getCandidateCreateOptions.prefetch().catch(() => null);

  return (
    <HydrateClient>
      <div className="min-h-screen w-full bg-white">
        <CreateCandidateForm />
      </div>
    </HydrateClient>
  );
}
