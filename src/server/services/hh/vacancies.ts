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
