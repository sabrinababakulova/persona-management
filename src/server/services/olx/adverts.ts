import sanitizeHtml from "sanitize-html";

import { validateOlxAdvertContent } from "~/shared/olx-validation";

import { fetchOlxJson, OlxApiError, unwrapOlxData } from "./shared";

export type OlxAdvertStatus =
  | "new"
  | "active"
  | "limited"
  | "removed_by_user"
  | "outdated"
  | "unconfirmed"
  | "unpaid"
  | "moderated"
  | "blocked"
  | "disabled"
  | "removed_by_moderator"
  | string;

export type OlxAdvertAttributeValue = {
  code: string;
  value?: string;
  values?: string[];
};

export type OlxAdvertPayload = {
  title: string;
  description: string;
  category_id: number;
  advertiser_type: "private" | "business";
  external_id: string;
  contact: {
    name: string;
    phone?: string;
  };
  location: {
    city_id: number;
    district_id?: number;
  };
  salary?: {
    value_from?: number;
    value_to?: number;
    currency: string;
    negotiable: boolean;
    type: "hourly" | "monthly";
  };
  attributes: OlxAdvertAttributeValue[];
  auto_extend_enabled: boolean;
};

export type OlxAdvert = {
  id: string;
  status: OlxAdvertStatus;
  url: string | null;
  title: string;
  externalId: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function parseOlxAdvert(body: unknown): OlxAdvert {
  const value = asRecord(unwrapOlxData<unknown>(body));
  if (
    !value ||
    (typeof value.id !== "number" && typeof value.id !== "string")
  ) {
    throw new Error("OLX advert response did not include an id");
  }
  return {
    id: String(value.id),
    status: typeof value.status === "string" ? value.status : "new",
    url: typeof value.url === "string" ? value.url : null,
    title: typeof value.title === "string" ? value.title : "",
    externalId:
      typeof value.external_id === "string"
        ? value.external_id
        : typeof value.external_id === "number"
          ? String(value.external_id)
          : null,
  };
}

function parseOlxAdvertList(body: unknown): OlxAdvert[] {
  const value = unwrapOlxData<unknown>(body);
  return Array.isArray(value)
    ? value.flatMap((item) => {
        try {
          return [parseOlxAdvert(item)];
        } catch {
          return [];
        }
      })
    : [];
}

export function sanitizeOlxJobDescription(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ["p", "ul", "li", "strong", "em"],
    allowedAttributes: {},
  }).trim();
}

export function prepareOlxAdvertPayload(
  input: Omit<OlxAdvertPayload, "description"> & { description: string },
): OlxAdvertPayload {
  const description = sanitizeOlxJobDescription(input.description);
  const issues = validateOlxAdvertContent({
    title: input.title,
    descriptionHtml: description,
  });
  if (issues.length > 0) {
    throw new OlxApiError({
      status: 400,
      message: issues.map((issue) => issue.message).join("; "),
      validationErrors: issues.map((issue) => ({
        field: issue.field,
        title: issue.message,
        detail: issue.message,
      })),
    });
  }

  const attributes: OlxAdvertAttributeValue[] = [];
  for (const attribute of input.attributes) {
    if (attribute.values && attribute.values.length > 0) {
      attributes.push({
        code: attribute.code,
        values: attribute.values,
      });
      continue;
    }
    if (attribute.value) {
      attributes.push({
        code: attribute.code,
        value: attribute.value,
      });
    }
  }

  return {
    ...input,
    title: input.title.trim(),
    description,
    contact: {
      name: input.contact.name.trim(),
      ...(input.contact.phone?.trim()
        ? { phone: input.contact.phone.trim() }
        : {}),
    },
    attributes,
  };
}

export async function findOlxAdvertByExternalId(
  accessToken: string,
  externalId: string,
): Promise<OlxAdvert | null> {
  const body = await fetchOlxJson<unknown>({
    accessToken,
    path: `/adverts?external_id=${encodeURIComponent(externalId)}&limit=10`,
  });
  return (
    parseOlxAdvertList(body).find(
      (advert) => advert.externalId === externalId,
    ) ?? null
  );
}

export async function fetchOlxAdvert(
  accessToken: string,
  advertId: string,
): Promise<OlxAdvert> {
  const body = await fetchOlxJson<unknown>({
    accessToken,
    path: `/adverts/${encodeURIComponent(advertId)}`,
  });
  return parseOlxAdvert(body);
}

export async function createOrUpdateOlxAdvert(input: {
  accessToken: string;
  advertId?: string | null;
  payload: OlxAdvertPayload;
}): Promise<OlxAdvert> {
  let advertId = input.advertId ?? null;
  if (!advertId) {
    advertId =
      (
        await findOlxAdvertByExternalId(
          input.accessToken,
          input.payload.external_id,
        )
      )?.id ?? null;
  }

  const body = await fetchOlxJson<unknown>({
    accessToken: input.accessToken,
    path: advertId ? `/adverts/${encodeURIComponent(advertId)}` : "/adverts",
    method: advertId ? "PUT" : "POST",
    body: input.payload,
  });
  return parseOlxAdvert(body);
}

export async function sendOlxAdvertCommand(
  accessToken: string,
  advertId: string,
  command: "activate" | "deactivate" | "finish" | "extend",
): Promise<void> {
  await fetchOlxJson<void>({
    accessToken,
    path: `/adverts/${encodeURIComponent(advertId)}/commands`,
    method: "POST",
    body:
      command === "deactivate" ? { command, is_success: false } : { command },
  });
}

export async function deleteOlxAdvert(
  accessToken: string,
  advertId: string,
): Promise<void> {
  const current = await fetchOlxAdvert(accessToken, advertId);
  if (current.status === "active") {
    await sendOlxAdvertCommand(accessToken, advertId, "deactivate");
  }
  await fetchOlxJson<void>({
    accessToken,
    path: `/adverts/${encodeURIComponent(advertId)}`,
    method: "DELETE",
  });
}

export function isOlxAdvertActive(status: OlxAdvertStatus): boolean {
  return status === "active";
}
