import { HhPublicationForm } from "../hh-publication-form";

export default async function VacancyPublicationIdPage({
  params,
}: {
  params: Promise<{ id: string; channel: string; pubid: string }>;
}) {
  const { id, channel, pubid } = await params;

  if (channel === "hh.uz") {
    return <HhPublicationForm pubId={pubid} vacancyId={id} />;
  }

  return (
    <main className="flex h-full flex-1 overflow-auto">
      <div className="flex min-h-full w-full flex-col p-8">
        {channel} is not supported yet
      </div>
    </main>
  );
}
