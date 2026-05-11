const CHANNEL_DISPLAY_NAME: Record<string, string> = {
  linkedin: "LinkedIn",
  "hh.uz": "HH",
  telegram: "Telegram",
};

export default async function VacancyPublicationChannelPage({
  params,
}: {
  params: Promise<{ id: string; channel: string }>;
}) {
  const { channel } = await params;
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
