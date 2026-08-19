import { env } from "~/env";
import { OLX_CONNECTOR_EXTENSION_ID } from "~/shared/publication-navigation";

const EXTENSION_ID_PATTERN = /^[a-p]{32}$/;

export function parseOlxConnectorExtensionIds(
  configuredId?: string,
  configuredIds?: string,
): string[] {
  const candidates = [
    OLX_CONNECTOR_EXTENSION_ID,
    configuredId,
    ...(configuredIds?.split(",") ?? []),
  ];

  return [
    ...new Set(candidates.filter((id) => EXTENSION_ID_PATTERN.test(id ?? ""))),
  ] as string[];
}

export function getAllowedOlxConnectorExtensionIds(): string[] {
  return parseOlxConnectorExtensionIds(
    env.OLX_CONNECTOR_EXTENSION_ID,
    env.OLX_CONNECTOR_EXTENSION_IDS,
  );
}

export function getOlxConnectorExtensionIdFromOrigin(
  origin: string | null,
  allowedExtensionIds = getAllowedOlxConnectorExtensionIds(),
): string | null {
  const prefix = "chrome-extension://";
  if (!origin?.startsWith(prefix)) return null;

  const extensionId = origin.slice(prefix.length);
  return allowedExtensionIds.includes(extensionId) ? extensionId : null;
}
