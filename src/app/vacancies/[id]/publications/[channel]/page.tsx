import { HhPublicationForm } from "./hh-publication-form";

/** Display labels for known channels; unknown channels fall back to their raw segment value. */
const CHANNEL_DISPLAY_NAME: Record<string, string> = {
  linkedin: "LinkedIn",
  "hh.uz": "HH",
  telegram: "Telegram",
};

/**
 * Per-channel publication editor entry point at
 * `/vacancies/[id]/publications/[channel]`.
 *
 * For `hh.uz` the page mounts the full {@link HhPublicationForm}; other channels currently render
 * a placeholder showing the channel name while their dedicated editors are built.
 */
export default async function VacancyPublicationChannelPage({
  params,
}: {
  params: Promise<{ id: string; channel: string }>;
}) {
  const { id, channel } = await params;

  if (channel === "hh.uz") {
    return <HhPublicationForm vacancyId={id} />;
  }

  const channelName = CHANNEL_DISPLAY_NAME[channel] ?? channel;

  return (
    <main className="flex h-full flex-1 overflow-auto">
      <div className="flex min-h-full w-full flex-col p-8">
        <h1 className="font-bold text-3xl text-text-heading">
          Публикация: {channelName}
        </h1>
      </div>
    </main>
  );
}
