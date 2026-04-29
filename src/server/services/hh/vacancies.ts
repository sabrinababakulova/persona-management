import { sanitizeHhDescriptionHtml } from "./sanitize-html";
import {
  fetchHhJson,
  getTotalFromSearchPayload,
  HH_API_ACTIVE_PER_PAGE,
  HH_API_ARCHIVED_PER_PAGE,
  HH_API_BASE_URL,
  type HhVacancy,
  type HhVacancyItem,
  type HhVacancyPage,
  type HhVacancySearchResponse,
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

export async function fetchCompanyHhVacancies(
  employerId: string,
  accessToken?: string,
): Promise<HhVacancy[]> {
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
    console.error("Failed to fetch active hh.uz vacancies", {
      employerId,
      error,
      hasAccessToken: Boolean(accessToken),
    });
  }

  try {
    await fetchKind("archived", HH_API_ARCHIVED_PER_PAGE);
  } catch (error) {
    console.error("Failed to fetch archived hh.uz vacancies", {
      employerId,
      error,
      hasAccessToken: Boolean(accessToken),
    });
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
    const activeBatch = await fetchHhVacanciesBatch({
      accessToken: input.accessToken,
      employerId: input.employerId,
      kind: "active",
      limit: input.limit,
      offset: input.offset,
    });

    activeItems = activeBatch.items;
    activeTotal = activeBatch.total;
  }

  let archivedItems: HhVacancy[] = [];
  let archivedTotal = 0;

  if (includeArchived) {
    const archivedOffset = Math.max(0, input.offset - activeTotal);
    const archivedLimit = Math.max(0, input.limit - activeItems.length);

    const archivedBatch = await fetchHhVacanciesBatch({
      accessToken: input.accessToken,
      employerId: input.employerId,
      kind: "archived",
      limit: archivedLimit,
      offset: archivedOffset,
    });

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

  if (fields.salaryFrom !== undefined || fields.salaryCurrency !== undefined) {
    body.salary = {
      from: fields.salaryFrom ?? null,
      to: null,
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
  vacancy_billing_type: HhDictionaryItem[];
  currency: HhDictionaryItem[];
};

export async function fetchHhDictionaries(): Promise<HhDictionaries> {
  const response = await fetchHhJson<{
    employment?: HhDictionaryItem[];
    schedule?: HhDictionaryItem[];
    experience?: HhDictionaryItem[];
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

export async function publishHhVacancy(
  input: PublishHhVacancyInput,
  accessToken: string,
): Promise<PublishHhVacancyResult> {
  const sanitizedDescription = sanitizeHhDescriptionHtml(input.description);

  const body: Record<string, unknown> = {
    name: input.name,
    description: sanitizedDescription,
    area: { id: input.areaId },
    employment: { id: input.employmentId },
    schedule: { id: input.scheduleId },
    experience: { id: input.experienceId },
    professional_roles: [{ id: input.professionalRoleId }],
    billing_type: { id: input.billingTypeId },
    type: { id: "open" },
    contacts: {
      name: input.contactName,
      email: input.contactEmail,
      ...(input.contactPhone ? { phones: [input.contactPhone] } : {}),
    },
  };

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
    throw new Error(
      `HH vacancy prolongation failed ${response.status}: ${errorBody}`,
    );
  }
}
