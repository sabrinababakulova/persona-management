import { sanitizeHhDescriptionHtml } from "./sanitize-html";
import {
  fetchHhJson,
  getTotalFromSearchPayload,
  HH_API_ACTIVE_PER_PAGE,
  HH_API_ARCHIVED_PER_PAGE,
  HH_API_BASE_URL,
  HhApiError,
  type HhVacancy,
  type HhVacancyItem,
  type HhVacancyPage,
  type HhVacancySearchResponse,
  isHhAuthenticationError,
  stripHtml,
  toHhDescriptionHtml,
  toHhSalaryCurrency,
  toHhSalaryExpectation,
  toHhVacancy,
} from "./shared";

export async function fetchHhVacancyById(
  vacancyId: string,
  accessToken?: string,
): Promise<{
  id: string;
  title: string;
  level: string;
  status: "active" | "archive";
  city: string;
  responses: number;
  workType: string;
  salaryExpectation?: number;
  salaryCurrency?: "UZS" | "USD";
  workScheduleStart?: string;
  workScheduleEnd?: string;
  comments?: string;
  tasks?: string;
  team?: string;
  companyDescription?: string;
  publishedAt?: string;
  externalUrl?: string;
}> {
  const searchParams = new URLSearchParams({
    host: "hh.uz",
  });

  const vacancy = await fetchHhJson<HhVacancyItem>(
    `${HH_API_BASE_URL}/vacancies/${vacancyId}?${searchParams}`,
    {
      headers: {
        Accept: "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      signal: AbortSignal.timeout(10_000),
    },
  );

  return {
    ...toHhVacancy(vacancy),
    salaryExpectation: toHhSalaryExpectation(vacancy),
    salaryCurrency: toHhSalaryCurrency(vacancy),
    workScheduleStart: undefined,
    workScheduleEnd: undefined,
    comments: "",
    tasks: stripHtml(vacancy.description),
    team: "",
    companyDescription: "",
  };
}

/**
 * Fetches the live response counter for each hh.uz vacancy id, keyed by id.
 *
 * hh.uz exposes no bulk-counter endpoint, so this issues one `GET /vacancies/{id}` per id
 * in parallel. Ids whose request fails are omitted from the result rather than failing the
 * whole batch.
 */
export async function fetchHhVacancyResponseCounts(
  vacancyIds: string[],
  accessToken: string,
): Promise<Map<string, number>> {
  const uniqueIds = [...new Set(vacancyIds)];

  const entries = await Promise.all(
    uniqueIds.map(async (id): Promise<[string, number] | null> => {
      try {
        const vacancy = await fetchHhJson<HhVacancyItem>(
          `${HH_API_BASE_URL}/vacancies/${encodeURIComponent(id)}?host=hh.uz`,
          {
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            signal: AbortSignal.timeout(10_000),
          },
        );
        const counters = vacancy.counters;
        return [id, counters?.total_responses ?? counters?.responses ?? 0];
      } catch (error) {
        console.error("Failed to fetch hh.uz vacancy response counter", {
          vacancyId: id,
          error,
        });
        return null;
      }
    }),
  );

  return new Map(
    entries.filter((entry): entry is [string, number] => entry !== null),
  );
}

export async function fetchCompanyHhVacancies(
  employerId: string,
  accessToken?: string,
  options?: {
    includeArchived?: boolean;
    throwOnAuthenticationError?: boolean;
  },
): Promise<HhVacancy[]> {
  const includeArchived = options?.includeArchived ?? true;
  const vacancies = new Map<string, HhVacancy>();

  const fetchKind = async (
    kind: "active" | "archived",
    perPage: number,
    extraParams?: Record<string, string>,
  ) => {
    if (!accessToken) {
      return;
    }

    let page = 0;
    let totalPages = 1;

    while (page < totalPages) {
      const searchParams = new URLSearchParams({
        host: "hh.uz",
        page: String(page),
        per_page: String(perPage),
        ...extraParams,
      });

      const payload = await fetchHhJson<HhVacancySearchResponse>(
        `${HH_API_BASE_URL}/employers/${employerId}/vacancies/${kind}?${searchParams}`,
        {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          signal: AbortSignal.timeout(10_000),
        },
      );

      const items = payload.items ?? [];
      for (const item of items) {
        const vacancy = toHhVacancy(item);
        vacancies.set(vacancy.id, vacancy);
      }

      totalPages = Math.max(payload.pages ?? 0, 1);
      page += 1;

      if (items.length === 0) {
        break;
      }
    }
  };

  try {
    await fetchKind("active", HH_API_ACTIVE_PER_PAGE, {
      all_accessible: "true",
    });
  } catch (error) {
    if (options?.throwOnAuthenticationError && isHhAuthenticationError(error)) {
      throw error;
    }
    console.error("Failed to fetch active hh.uz vacancies", {
      employerId,
      error,
      hasAccessToken: Boolean(accessToken),
    });
  }

  if (includeArchived) {
    try {
      await fetchKind("archived", HH_API_ARCHIVED_PER_PAGE);
    } catch (error) {
      if (
        options?.throwOnAuthenticationError &&
        isHhAuthenticationError(error)
      ) {
        throw error;
      }
      console.error("Failed to fetch archived hh.uz vacancies", {
        employerId,
        error,
        hasAccessToken: Boolean(accessToken),
      });
    }
  }

  return [...vacancies.values()];
}

async function fetchHhVacanciesBatch(input: {
  accessToken?: string;
  employerId: string;
  kind: "active" | "archived";
  limit: number;
  offset: number;
}): Promise<HhVacancyPage> {
  if (input.limit <= 0 || !input.accessToken) {
    return { items: [], total: 0 };
  }

  const perPage =
    input.kind === "active" ? HH_API_ACTIVE_PER_PAGE : HH_API_ARCHIVED_PER_PAGE;

  const items: HhVacancy[] = [];
  const pageOffset = Math.max(input.offset, 0);
  let page = Math.floor(pageOffset / perPage);
  let skip = pageOffset % perPage;
  let totalPages = page + 1;
  let total = 0;

  while (items.length < input.limit && page < totalPages) {
    const searchParams = new URLSearchParams({
      host: "hh.uz",
      page: String(page),
      per_page: String(perPage),
      ...(input.kind === "active" ? { all_accessible: "true" } : {}),
    });

    const payload = await fetchHhJson<HhVacancySearchResponse>(
      `${HH_API_BASE_URL}/employers/${input.employerId}/vacancies/${input.kind}?${searchParams}`,
      {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${input.accessToken}`,
        },
        signal: AbortSignal.timeout(10_000),
      },
    );

    const pageItems = payload.items ?? [];
    totalPages = Math.max(payload.pages ?? 0, page + 1);
    total = getTotalFromSearchPayload(payload);

    const slicedItems = pageItems.slice(skip);
    skip = 0;

    for (const item of slicedItems) {
      items.push(toHhVacancy(item));

      if (items.length >= input.limit) {
        break;
      }
    }

    page += 1;
    if (pageItems.length === 0) {
      break;
    }
  }

  return { items, total };
}

async function fetchHhVacanciesTotal(input: {
  accessToken?: string;
  employerId: string;
  kind: "active" | "archived";
}): Promise<number> {
  if (!input.accessToken) {
    return 0;
  }

  const searchParams = new URLSearchParams({
    host: "hh.uz",
    page: "0",
    per_page: "1",
    ...(input.kind === "active" ? { all_accessible: "true" } : {}),
  });

  const payload = await fetchHhJson<HhVacancySearchResponse>(
    `${HH_API_BASE_URL}/employers/${input.employerId}/vacancies/${input.kind}?${searchParams}`,
    {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${input.accessToken}`,
      },
      signal: AbortSignal.timeout(10_000),
    },
  );

  return getTotalFromSearchPayload(payload);
}

export async function fetchCompanyHhVacanciesPage(input: {
  accessToken?: string;
  employerId: string;
  includeActive?: boolean;
  includeArchived?: boolean;
  limit: number;
  offset: number;
}): Promise<HhVacancyPage> {
  const includeActive = input.includeActive ?? true;
  const includeArchived = input.includeArchived ?? true;

  let activeItems: HhVacancy[] = [];
  let activeTotal = 0;

  if (includeActive) {
    const activeBatch =
      input.limit > 0
        ? await fetchHhVacanciesBatch({
            accessToken: input.accessToken,
            employerId: input.employerId,
            kind: "active",
            limit: input.limit,
            offset: input.offset,
          })
        : {
            items: [],
            total: await fetchHhVacanciesTotal({
              accessToken: input.accessToken,
              employerId: input.employerId,
              kind: "active",
            }),
          };

    activeItems = activeBatch.items;
    activeTotal = activeBatch.total;
  }

  let archivedItems: HhVacancy[] = [];
  let archivedTotal = 0;

  if (includeArchived) {
    const archivedOffset = Math.max(0, input.offset - activeTotal);
    const archivedLimit = Math.max(0, input.limit - activeItems.length);

    const archivedBatch =
      archivedLimit > 0
        ? await fetchHhVacanciesBatch({
            accessToken: input.accessToken,
            employerId: input.employerId,
            kind: "archived",
            limit: archivedLimit,
            offset: archivedOffset,
          })
        : {
            items: [],
            total: await fetchHhVacanciesTotal({
              accessToken: input.accessToken,
              employerId: input.employerId,
              kind: "archived",
            }),
          };

    archivedItems = archivedBatch.items;
    archivedTotal = archivedBatch.total;
  }

  return {
    items: [...activeItems, ...archivedItems],
    total: activeTotal + archivedTotal,
  };
}

export async function updateHhVacancyContent(
  vacancyId: string,
  accessToken: string,
  fields: {
    name?: string;
    description?: string;
    salaryFrom?: number | null;
    salaryTo?: number | null;
    salaryCurrency?: string;
  },
) {
  const body: Record<string, unknown> = {};

  if (fields.name !== undefined) {
    body.name = fields.name;
  }

  if (fields.description !== undefined) {
    body.description = toHhDescriptionHtml(fields.description);
  }

  if (
    fields.salaryFrom !== undefined ||
    fields.salaryTo !== undefined ||
    fields.salaryCurrency !== undefined
  ) {
    body.salary = {
      from: fields.salaryFrom ?? null,
      to: fields.salaryTo ?? null,
      currency: fields.salaryCurrency ?? "USD",
      gross: false,
    };
  }

  if (Object.keys(body).length === 0) {
    return;
  }

  const searchParams = new URLSearchParams({ host: "hh.uz" });

  const response = await fetch(
    `${HH_API_BASE_URL}/vacancies/${vacancyId}?${searchParams}`,
    {
      method: "PUT",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    },
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `HH vacancy update failed ${response.status}: ${errorBody}`,
    );
  }
}

export async function archiveHhVacancy(
  vacancyId: string,
  employerId: string,
  accessToken: string,
) {
  const searchParams = new URLSearchParams({ host: "hh.uz" });

  const response = await fetch(
    `${HH_API_BASE_URL}/employers/${employerId}/vacancies/active/${vacancyId}?${searchParams}`,
    {
      method: "DELETE",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      signal: AbortSignal.timeout(10_000),
    },
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `HH vacancy archive failed ${response.status}: ${errorBody}`,
    );
  }
}

export type HhDictionaryItem = { id: string; name: string };

export type HhArea = {
  id: string;
  name: string;
  parent_id: string | null;
  areas?: HhArea[];
};

export type HhProfessionalRoleCategory = {
  id: string;
  name: string;
  roles: HhDictionaryItem[];
};

export type HhDictionaries = {
  employment: HhDictionaryItem[];
  schedule: HhDictionaryItem[];
  experience: HhDictionaryItem[];
  vacancy_type: HhDictionaryItem[];
  vacancy_billing_type: HhDictionaryItem[];
  currency: HhDictionaryItem[];
};

export async function fetchHhDictionaries(): Promise<HhDictionaries> {
  const response = await fetchHhJson<{
    employment?: HhDictionaryItem[];
    schedule?: HhDictionaryItem[];
    experience?: HhDictionaryItem[];
    vacancy_type?: HhDictionaryItem[];
    vacancy_billing_type?: HhDictionaryItem[];
    currency?: { code: string; name: string }[];
  }>(`${HH_API_BASE_URL}/dictionaries?host=hh.uz`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });

  return {
    employment: response.employment ?? [],
    schedule: response.schedule ?? [],
    experience: response.experience ?? [],
    vacancy_type: response.vacancy_type ?? [],
    vacancy_billing_type: response.vacancy_billing_type ?? [],
    currency: (response.currency ?? []).map((c) => ({
      id: c.code,
      name: c.name,
    })),
  };
}

export async function fetchHhAreasUz(): Promise<HhDictionaryItem[]> {
  const root = await fetchHhJson<HhArea>(`${HH_API_BASE_URL}/areas/97`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });

  const flat: HhDictionaryItem[] = [];
  const visit = (node: HhArea) => {
    flat.push({ id: node.id, name: node.name });
    for (const child of node.areas ?? []) {
      visit(child);
    }
  };
  for (const child of root.areas ?? []) {
    visit(child);
  }
  return flat;
}

export async function fetchHhProfessionalRoles(): Promise<
  HhProfessionalRoleCategory[]
> {
  const response = await fetchHhJson<{
    categories?: Array<{
      id: string;
      name: string;
      roles?: HhDictionaryItem[];
    }>;
  }>(`${HH_API_BASE_URL}/professional_roles`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });

  return (response.categories ?? []).map((category) => ({
    id: category.id,
    name: category.name,
    roles: category.roles ?? [],
  }));
}

export type PublishHhVacancyInput = {
  name: string;
  description: string;
  areaId: string;
  employmentId: string;
  scheduleId: string;
  experienceId: string;
  professionalRoleId: string;
  vacancyTypeId: string;
  billingTypeId: string;
  salaryFrom?: number | null;
  salaryTo?: number | null;
  salaryCurrency?: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: {
    country: string;
    city: string;
    number: string;
  } | null;
};

export type PublishHhVacancyResult = {
  id: string;
  alternateUrl: string;
};

function buildHhVacancyBody(input: Partial<PublishHhVacancyInput>) {
  const body: Record<string, unknown> = {};

  if (input.name) {
    body.name = input.name;
  }
  if (input.description) {
    body.description = sanitizeHhDescriptionHtml(input.description);
  }
  if (input.areaId) {
    body.area = { id: input.areaId };
  }
  if (input.employmentId) {
    body.employment = { id: input.employmentId };
  }
  if (input.scheduleId) {
    body.schedule = { id: input.scheduleId };
  }
  if (input.experienceId) {
    body.experience = { id: input.experienceId };
  }
  if (input.professionalRoleId) {
    body.professional_roles = [{ id: input.professionalRoleId }];
  }
  if (input.billingTypeId) {
    body.billing_type = { id: input.billingTypeId };
  }
  if (input.vacancyTypeId) {
    body.type = { id: input.vacancyTypeId };
  }
  if (input.contactName && input.contactEmail) {
    body.contacts = {
      name: input.contactName,
      email: input.contactEmail,
      ...(input.contactPhone ? { phones: [input.contactPhone] } : {}),
    };
  }

  if (
    input.salaryFrom !== undefined ||
    input.salaryTo !== undefined ||
    input.salaryCurrency !== undefined
  ) {
    body.salary = {
      from: input.salaryFrom ?? null,
      to: input.salaryTo ?? null,
      currency: input.salaryCurrency ?? "UZS",
      gross: false,
    };
  }

  return body;
}

export async function publishHhVacancy(
  input: PublishHhVacancyInput,
  accessToken: string,
): Promise<PublishHhVacancyResult> {
  const body = buildHhVacancyBody(input);
  const searchParams = new URLSearchParams({ host: "hh.uz" });

  const response = await fetch(`${HH_API_BASE_URL}/vacancies?${searchParams}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `HH vacancy publish failed ${response.status}: ${errorBody}`,
    );
  }

  const created = (await response.json()) as {
    id?: string;
    alternate_url?: string;
  };

  if (!created.id) {
    throw new Error("HH vacancy publish: missing id in response");
  }

  return {
    id: created.id,
    alternateUrl:
      created.alternate_url ?? `https://hh.uz/vacancy/${created.id}`,
  };
}

export type SaveHhVacancyDraftInput = Partial<PublishHhVacancyInput> & {
  name: string;
};

export type SaveHhVacancyDraftResult = {
  id: string;
  name: string;
  publicationReady: boolean;
  ignoredFields: string[];
  validationErrors: Array<{ value: string; reason?: string }>;
  apiUrl: string;
};

export async function saveHhVacancyDraft(
  input: SaveHhVacancyDraftInput,
  accessToken: string,
  draftId?: string | null,
): Promise<SaveHhVacancyDraftResult> {
  const body = buildHhVacancyBody(input);
  const searchParams = new URLSearchParams({ host: "hh.uz" });
  const endpoint = draftId
    ? `${HH_API_BASE_URL}/vacancies/drafts/${draftId}?${searchParams}`
    : `${HH_API_BASE_URL}/vacancies/drafts?${searchParams}`;

  const response = await fetch(endpoint, {
    method: draftId ? "PUT" : "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    if (draftId && response.status === 404) {
      return saveHhVacancyDraft(input, accessToken);
    }

    const errorBody = await response.text();
    throw new Error(
      `HH vacancy draft save failed ${response.status}: ${errorBody}`,
    );
  }

  const saved = (await response.json()) as {
    id?: string;
    name?: string;
    publication_ready?: boolean;
    ignored_fields?: string[];
    validation_errors?: Array<{ value?: string; reason?: string }>;
  };

  if (!saved.id) {
    throw new Error("HH vacancy draft save: missing id in response");
  }

  return {
    id: saved.id,
    name: saved.name ?? input.name,
    publicationReady: saved.publication_ready ?? false,
    ignoredFields: saved.ignored_fields ?? [],
    validationErrors: (saved.validation_errors ?? [])
      .map((error) => ({
        value: error.value ?? "",
        reason: error.reason,
      }))
      .filter((error) => error.value),
    apiUrl: `${HH_API_BASE_URL}/vacancies/drafts/${saved.id}`,
  };
}

export type HhVacancyDetail = {
  id: string;
  name: string;
  descriptionHtml: string;
  // Human-readable display labels paired with their lookup IDs below.
  area: string | null;
  employment: string | null;
  schedule: string | null;
  experience: string | null;
  // Lookup IDs, surfaced for the edit form so it can resolve them via hh.uz dictionaries.
  areaId: string | null;
  employmentId: string | null;
  scheduleId: string | null;
  experienceId: string | null;
  professionalRoleIds: string[];
  vacancyTypeId: string | null;
  billingTypeId: string | null;
  workFormats: string[];
  professionalRoles: string[];
  keySkills: string[];
  billingType: string | null;
  type: string | null;
  archived: boolean;
  hidden: boolean;
  publishedAt: string | null;
  createdAt: string | null;
  initialCreatedAt: string | null;
  expiresAt: string | null;
  acceptHandicapped: boolean | null;
  acceptKids: boolean | null;
  acceptIncompleteResumes: boolean | null;
  responseLetterRequired: boolean | null;
  allowMessages: boolean | null;
  responseUrl: string | null;
  alternateUrl: string | null;
  applyAlternateUrl: string | null;
  salary: {
    from: number | null;
    to: number | null;
    currency: string | null;
    gross: boolean | null;
  } | null;
  employer: {
    id: string | null;
    name: string | null;
    url: string | null;
    logoUrl: string | null;
    trusted: boolean | null;
  } | null;
  contacts: {
    name: string | null;
    email: string | null;
    phones: Array<{
      country: string | null;
      city: string | null;
      number: string | null;
      formatted: string | null;
      comment: string | null;
    }>;
  } | null;
  address: {
    city: string | null;
    street: string | null;
    building: string | null;
    description: string | null;
    raw: string | null;
  } | null;
  department: { id: string | null; name: string | null } | null;
  language: Array<{ name: string | null; level: string | null }>;
  driverLicenseTypes: string[];
  counters: {
    views: number | null;
    responses: number | null;
    totalResponses: number | null;
  };
  testRequired: boolean | null;
  code: string | null;
  branding: { type: string | null; tariff: string | null } | null;
};

type HhVacancyDetailRaw = {
  id?: string | null;
  name?: string | null;
  description?: string | null;
  area?: { id?: string | null; name?: string | null } | null;
  employment?: { id?: string | null; name?: string | null } | null;
  schedule?: { id?: string | null; name?: string | null } | null;
  experience?: { id?: string | null; name?: string | null } | null;
  work_format?: Array<{ name?: string | null }> | null;
  professional_roles?: Array<{
    id?: string | null;
    name?: string | null;
  }> | null;
  key_skills?: Array<{ name?: string | null }> | null;
  billing_type?: { id?: string | null; name?: string | null } | null;
  type?: { id?: string | null; name?: string | null } | null;
  archived?: boolean | null;
  hidden?: boolean | null;
  published_at?: string | null;
  created_at?: string | null;
  initial_created_at?: string | null;
  expires_at?: string | null;
  accept_handicapped?: boolean | null;
  accept_kids?: boolean | null;
  accept_incomplete_resumes?: boolean | null;
  response_letter_required?: boolean | null;
  allow_messages?: boolean | null;
  response_url?: string | null;
  alternate_url?: string | null;
  apply_alternate_url?: string | null;
  salary?: {
    from?: number | null;
    to?: number | null;
    currency?: string | null;
    gross?: boolean | null;
  } | null;
  employer?: {
    id?: string | null;
    name?: string | null;
    alternate_url?: string | null;
    logo_urls?: { original?: string | null; "240"?: string | null } | null;
    trusted?: boolean | null;
  } | null;
  contacts?: {
    name?: string | null;
    email?: string | null;
    phones?: Array<{
      country?: string | null;
      city?: string | null;
      number?: string | null;
      formatted?: string | null;
      comment?: string | null;
    }> | null;
  } | null;
  address?: {
    city?: string | null;
    street?: string | null;
    building?: string | null;
    description?: string | null;
    raw?: string | null;
  } | null;
  department?: { id?: string | null; name?: string | null } | null;
  languages?: Array<{
    name?: string | null;
    level?: { name?: string | null } | null;
  }> | null;
  driver_license_types?: Array<{ id?: string | null }> | null;
  counters?: {
    views?: number | null;
    responses?: number | null;
    total_responses?: number | null;
  } | null;
  test?: { required?: boolean | null } | null;
  code?: string | null;
  branding?: { type?: string | null; tariff?: string | null } | null;
};

export async function fetchHhVacancyDetail(
  vacancyId: string,
  accessToken?: string,
): Promise<HhVacancyDetail> {
  const searchParams = new URLSearchParams({ host: "hh.uz" });

  const raw = await fetchHhJson<HhVacancyDetailRaw>(
    `${HH_API_BASE_URL}/vacancies/${vacancyId}?${searchParams}`,
    {
      headers: {
        Accept: "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      signal: AbortSignal.timeout(10_000),
    },
  );

  const phones = (raw.contacts?.phones ?? []).map((phone) => ({
    country: phone.country ?? null,
    city: phone.city ?? null,
    number: phone.number ?? null,
    formatted: phone.formatted ?? null,
    comment: phone.comment ?? null,
  }));

  return {
    id: raw.id ?? vacancyId,
    name: raw.name?.trim() || "",
    descriptionHtml: raw.description ?? "",
    area: raw.area?.name?.trim() || null,
    employment: raw.employment?.name?.trim() || null,
    schedule: raw.schedule?.name?.trim() || null,
    experience: raw.experience?.name?.trim() || null,
    areaId: raw.area?.id?.trim() || null,
    employmentId: raw.employment?.id?.trim() || null,
    scheduleId: raw.schedule?.id?.trim() || null,
    experienceId: raw.experience?.id?.trim() || null,
    professionalRoleIds: (raw.professional_roles ?? [])
      .map((item) => item.id?.trim())
      .filter((id): id is string => Boolean(id)),
    vacancyTypeId: raw.type?.id?.trim() || null,
    billingTypeId: raw.billing_type?.id?.trim() || null,
    workFormats: (raw.work_format ?? [])
      .map((item) => item.name?.trim())
      .filter((name): name is string => Boolean(name)),
    professionalRoles: (raw.professional_roles ?? [])
      .map((item) => item.name?.trim())
      .filter((name): name is string => Boolean(name)),
    keySkills: (raw.key_skills ?? [])
      .map((item) => item.name?.trim())
      .filter((name): name is string => Boolean(name)),
    billingType: raw.billing_type?.name?.trim() || null,
    type: raw.type?.name?.trim() || null,
    archived: raw.archived ?? false,
    hidden: raw.hidden ?? false,
    publishedAt: raw.published_at ?? null,
    createdAt: raw.created_at ?? null,
    initialCreatedAt: raw.initial_created_at ?? null,
    expiresAt: raw.expires_at ?? null,
    acceptHandicapped: raw.accept_handicapped ?? null,
    acceptKids: raw.accept_kids ?? null,
    acceptIncompleteResumes: raw.accept_incomplete_resumes ?? null,
    responseLetterRequired: raw.response_letter_required ?? null,
    allowMessages: raw.allow_messages ?? null,
    responseUrl: raw.response_url ?? null,
    alternateUrl: raw.alternate_url ?? null,
    applyAlternateUrl: raw.apply_alternate_url ?? null,
    salary: raw.salary
      ? {
          from: raw.salary.from ?? null,
          to: raw.salary.to ?? null,
          currency: raw.salary.currency ?? null,
          gross: raw.salary.gross ?? null,
        }
      : null,
    employer: raw.employer
      ? {
          id: raw.employer.id ?? null,
          name: raw.employer.name ?? null,
          url: raw.employer.alternate_url ?? null,
          logoUrl:
            raw.employer.logo_urls?.original ??
            raw.employer.logo_urls?.["240"] ??
            null,
          trusted: raw.employer.trusted ?? null,
        }
      : null,
    contacts: raw.contacts
      ? {
          name: raw.contacts.name ?? null,
          email: raw.contacts.email ?? null,
          phones,
        }
      : null,
    address: raw.address
      ? {
          city: raw.address.city ?? null,
          street: raw.address.street ?? null,
          building: raw.address.building ?? null,
          description: raw.address.description ?? null,
          raw: raw.address.raw ?? null,
        }
      : null,
    department: raw.department
      ? {
          id: raw.department.id ?? null,
          name: raw.department.name ?? null,
        }
      : null,
    language: (raw.languages ?? []).map((language) => ({
      name: language.name ?? null,
      level: language.level?.name ?? null,
    })),
    driverLicenseTypes: (raw.driver_license_types ?? [])
      .map((item) => item.id?.trim())
      .filter((id): id is string => Boolean(id)),
    counters: {
      views: raw.counters?.views ?? null,
      responses: raw.counters?.responses ?? null,
      totalResponses: raw.counters?.total_responses ?? null,
    },
    testRequired: raw.test?.required ?? null,
    code: raw.code ?? null,
    branding: raw.branding
      ? {
          type: raw.branding.type ?? null,
          tariff: raw.branding.tariff ?? null,
        }
      : null,
  };
}

/**
 * Calls `POST /vacancies/{vacancy_id}/prolongate` to extend a vacancy's publication
 * period. For an archived vacancy this brings it back to active when the employer still
 * has quota / purchased services to spend; otherwise hh.uz returns 403 with one of the
 * `errors[].value` discriminators (e.g. `unavailable_for_archived`, `quota_exceeded`)
 * which the caller can pull off the thrown {@link HhApiError}.
 */
export async function prolongHhVacancy(vacancyId: string, accessToken: string) {
  const searchParams = new URLSearchParams({ host: "hh.uz" });

  const response = await fetch(
    `${HH_API_BASE_URL}/vacancies/${vacancyId}/prolongate?${searchParams}`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      signal: AbortSignal.timeout(10_000),
    },
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new HhApiError(response.status, errorBody);
  }
}
