import { getTranslations } from "next-intl/server";
import { HhPublicationForm } from "./hh-publication-form";
import { PersonHunterPublicationForm } from "./person-hunter-publication-form";
import { TgPublicationForm } from "./tg-publication-form";

/** Display labels for known channels; unknown channels fall back to their raw segment value. */
const CHANNEL_DISPLAY_NAME: Record<string, string> = {
  linkedin: "LinkedIn",
  "hh.uz": "HH",
  telegram: "Telegram",
  "person-hunter": "PersonHunters",
  "olx.uz": "OLX.uz",
  "rabota.ru": "rabota.ru",
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
  const t = await getTranslations("VacancyDetail");

  if (channel === "hh.uz") {
    return <HhPublicationForm vacancyId={id} />;
  }

  if (channel === "telegram") {
    return <TgPublicationForm vacancyId={id} />;
  }

  if (channel === "person-hunter") {
    return <PersonHunterPublicationForm vacancyId={id} />;
  }

  const channelName = CHANNEL_DISPLAY_NAME[channel] ?? channel;

  return (
    <main className="flex h-full flex-1 overflow-auto bg-bg-canvas">
      <div className="app-page flex min-h-full flex-col">
        <h1 className="page-title">
          {t("publicationFor", { channel: channelName })}
        </h1>
      </div>
    </main>
  );
}
