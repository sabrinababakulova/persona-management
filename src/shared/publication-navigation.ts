export const OLX_PUBLICATION_CHANNEL = "olx.uz";
export const OLX_ACCOUNT_SECTION_ID = "olx-account";
export const OLX_ACCOUNT_SETTINGS_URL = `/my-profile?section=company-settings#${OLX_ACCOUNT_SECTION_ID}`;

export function getPublicationCreationUrl({
  channel,
  isOlxConnected,
  vacancyId,
}: {
  channel: string;
  isOlxConnected: boolean;
  vacancyId: string;
}): string {
  if (channel === OLX_PUBLICATION_CHANNEL && !isOlxConnected) {
    return OLX_ACCOUNT_SETTINGS_URL;
  }

  return `/vacancies/${encodeURIComponent(vacancyId)}/publications/${encodeURIComponent(channel)}`;
}
