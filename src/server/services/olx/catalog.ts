import { env } from "~/env";

import { fetchOlxJson, unwrapOlxData } from "./shared";

export type OlxCategory = {
  id: number;
  name: string;
  parentId: number | null;
  photosLimit: number;
  isLeaf: boolean;
};

export type OlxCategoryOption = OlxCategory & {
  path: string;
};

export type OlxCity = {
  id: number;
  regionId: number | null;
  name: string;
};

export type OlxDistrict = {
  id: number;
  cityId: number;
  name: string;
};

export type OlxCurrency = {
  code: string;
  label: string;
  isDefault: boolean;
};

export type OlxAttribute = {
  code: string;
  label: string;
  unit: string | null;
  validation: {
    type: "salary" | "price" | "attribute";
    required: boolean;
    numeric: boolean;
    min: number | null;
    max: number | null;
    allowMultipleValues: boolean;
  };
  values: { code: string; label: string }[];
};

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function numericId(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }
  if (typeof value === "string" && /^\d+$/.test(value)) {
    return Number(value);
  }
  return null;
}

function parseCategories(body: unknown): OlxCategory[] {
  const items = unwrapOlxData<unknown>(body);
  if (!Array.isArray(items)) {
    return [];
  }
  return items.flatMap((item) => {
    const value = record(item);
    const id = numericId(value?.id);
    const name = typeof value?.name === "string" ? value.name.trim() : "";
    if (id === null || !name) {
      return [];
    }
    return [
      {
        id,
        name,
        parentId: numericId(value?.parent_id),
        photosLimit: numericId(value?.photos_limit) ?? 0,
        isLeaf: value?.is_leaf === true,
      },
    ];
  });
}

export async function fetchOlxCategories(
  accessToken: string,
  parentId?: number,
): Promise<OlxCategory[]> {
  const query =
    parentId === undefined ? "" : `?parent_id=${encodeURIComponent(parentId)}`;
  const body = await fetchOlxJson<unknown>({
    accessToken,
    path: `/categories${query}`,
  });
  return parseCategories(body);
}

function normalizeCategoryName(value: string): string {
  return value
    .toLocaleLowerCase("ru")
    .replace(/[ё']/g, (char) => (char === "ё" ? "е" : ""));
}

function isJobsCategory(category: OlxCategory): boolean {
  const name = normalizeCategoryName(category.name);
  return (
    name === "работа" ||
    name === "вакансии" ||
    name === "ish" ||
    name === "vakansiyalar" ||
    name === "jobs" ||
    name.includes("работ")
  );
}

/**
 * Loads only the OLX Jobs branch. The Partner API can return either a flat category list or
 * one level at a time depending on the market, so the traversal supports both response shapes.
 */
export async function fetchOlxJobCategoryOptions(
  accessToken: string,
): Promise<OlxCategoryOption[]> {
  const initial = await fetchOlxCategories(accessToken);
  const configuredRoot = env.OLX_JOBS_CATEGORY_ID
    ? Number(env.OLX_JOBS_CATEGORY_ID)
    : null;
  let root =
    initial.find((category) => category.id === configuredRoot) ??
    initial.find(isJobsCategory);

  if (!root && configuredRoot !== null) {
    const configuredChildren = await fetchOlxCategories(
      accessToken,
      configuredRoot,
    );
    if (configuredChildren.length > 0) {
      root = {
        id: configuredRoot,
        name: "Работа",
        parentId: null,
        photosLimit: 0,
        isLeaf: false,
      };
      initial.push(...configuredChildren);
    }
  }

  if (!root) {
    throw new Error(
      "OLX.uz не вернул категорию «Работа». Укажите OLX_JOBS_CATEGORY_ID из Partner API.",
    );
  }

  const known = new Map(initial.map((category) => [category.id, category]));
  const pathById = new Map<number, string>([[root.id, root.name]]);
  const queue = [root];
  const leaves: OlxCategoryOption[] = [];
  const visited = new Set<number>();

  while (queue.length > 0 && visited.size < 250) {
    const current = queue.shift();
    if (!current || visited.has(current.id)) {
      continue;
    }
    visited.add(current.id);

    if (current.isLeaf) {
      leaves.push({
        ...current,
        path: pathById.get(current.id) ?? current.name,
      });
      continue;
    }

    let children = [...known.values()].filter(
      (candidate) => candidate.parentId === current.id,
    );
    if (children.length === 0) {
      children = await fetchOlxCategories(accessToken, current.id);
      for (const child of children) {
        known.set(child.id, child);
      }
    }

    const currentPath = pathById.get(current.id) ?? current.name;
    for (const child of children) {
      pathById.set(child.id, `${currentPath} — ${child.name}`);
      queue.push(child);
    }
  }

  if (leaves.length === 0 && root.isLeaf) {
    leaves.push({ ...root, path: root.name });
  }

  return leaves.sort((a, b) => a.path.localeCompare(b.path, "ru"));
}

export async function fetchOlxCities(accessToken: string): Promise<OlxCity[]> {
  const body = await fetchOlxJson<unknown>({
    accessToken,
    path: "/cities?offset=0&limit=1000",
  });
  const items = unwrapOlxData<unknown>(body);
  if (!Array.isArray(items)) {
    return [];
  }
  return items
    .flatMap((item) => {
      const value = record(item);
      const id = numericId(value?.id);
      const name = typeof value?.name === "string" ? value.name.trim() : "";
      if (id === null || !name) {
        return [];
      }
      return [{ id, name, regionId: numericId(value?.region_id) }];
    })
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));
}

export async function fetchOlxDistricts(
  accessToken: string,
  cityId: number,
): Promise<OlxDistrict[]> {
  const body = await fetchOlxJson<unknown>({
    accessToken,
    path: `/cities/${cityId}/districts`,
  });
  const items = unwrapOlxData<unknown>(body);
  if (!Array.isArray(items)) {
    return [];
  }
  return items.flatMap((item) => {
    const value = record(item);
    const id = numericId(value?.id);
    const parsedCityId = numericId(value?.city_id) ?? cityId;
    const name = typeof value?.name === "string" ? value.name.trim() : "";
    return id === null || !name ? [] : [{ id, cityId: parsedCityId, name }];
  });
}

export async function fetchOlxCurrencies(
  accessToken: string,
): Promise<OlxCurrency[]> {
  const body = await fetchOlxJson<unknown>({
    accessToken,
    path: "/currencies",
  });
  const items = unwrapOlxData<unknown>(body);
  if (!Array.isArray(items)) {
    return [];
  }
  return items.flatMap((item) => {
    const value = record(item);
    const code =
      typeof value?.code === "string" ? value.code.trim().toUpperCase() : "";
    if (!code) {
      return [];
    }
    return [
      {
        code,
        label:
          typeof value?.label === "string" && value.label.trim()
            ? value.label.trim()
            : code,
        isDefault: value?.is_default === true,
      },
    ];
  });
}

export async function fetchOlxCategoryAttributes(
  accessToken: string,
  categoryId: number,
): Promise<OlxAttribute[]> {
  const body = await fetchOlxJson<unknown>({
    accessToken,
    path: `/categories/${categoryId}/attributes`,
  });
  const items = unwrapOlxData<unknown>(body);
  if (!Array.isArray(items)) {
    return [];
  }

  return items.flatMap((item) => {
    const value = record(item);
    const code = typeof value?.code === "string" ? value.code.trim() : "";
    const label = typeof value?.label === "string" ? value.label.trim() : "";
    if (!code || !label) {
      return [];
    }
    const validation = record(value?.validation);
    const rawType = validation?.type;
    const type =
      rawType === "salary" || rawType === "price" ? rawType : "attribute";
    const values = Array.isArray(value?.values)
      ? value.values.flatMap((option) => {
          const parsed = record(option);
          const optionCode =
            typeof parsed?.code === "string"
              ? parsed.code
              : typeof parsed?.code === "number"
                ? String(parsed.code)
                : "";
          const optionLabel =
            typeof parsed?.label === "string" ? parsed.label.trim() : "";
          return optionCode && optionLabel
            ? [{ code: optionCode, label: optionLabel }]
            : [];
        })
      : [];

    return [
      {
        code,
        label,
        unit: typeof value?.unit === "string" ? value.unit : null,
        validation: {
          type,
          required: validation?.required === true,
          numeric: validation?.numeric === true,
          min: numericId(validation?.min),
          max: numericId(validation?.max),
          allowMultipleValues: validation?.allow_multiple_values === true,
        },
        values,
      },
    ];
  });
}
