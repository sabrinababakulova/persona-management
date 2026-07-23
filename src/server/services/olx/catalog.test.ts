import { afterEach, describe, expect, test } from "bun:test";

import {
  fetchOlxCategoryAttributes,
  fetchOlxCities,
  fetchOlxJobCategoryOptions,
} from "./catalog";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
}

describe("OLX catalog parsing", () => {
  test("extracts and sorts leaf categories from the jobs branch", async () => {
    globalThis.fetch = (async () =>
      jsonResponse([
        {
          id: 1,
          name: "Работа",
          parent_id: null,
          is_leaf: false,
          photos_limit: 0,
        },
        {
          id: 3,
          name: "Продажи",
          parent_id: 1,
          is_leaf: true,
          photos_limit: 0,
        },
        {
          id: 2,
          name: "IT и телеком",
          parent_id: 1,
          is_leaf: true,
          photos_limit: 0,
        },
      ])) as typeof fetch;

    const categories = await fetchOlxJobCategoryOptions("token");

    expect(categories.map((category) => category.path)).toEqual([
      "Работа — Продажи",
      "Работа — IT и телеком",
    ]);
  });

  test("normalizes ids and validation metadata from OLX", async () => {
    globalThis.fetch = (async (input) => {
      const url = String(input);
      if (url.includes("/cities")) {
        return jsonResponse([
          { id: "2", region_id: "10", name: "Самарканд" },
          { id: 1, region_id: 10, name: "Ташкент" },
        ]);
      }
      return jsonResponse([
        {
          code: "experience",
          label: "Опыт работы",
          validation: {
            type: "attribute",
            required: true,
            numeric: true,
            min: 0,
            max: "50",
            allow_multiple_values: false,
          },
          values: [],
        },
      ]);
    }) as typeof fetch;

    await expect(fetchOlxCities("token")).resolves.toEqual([
      { id: 2, name: "Самарканд", regionId: 10 },
      { id: 1, name: "Ташкент", regionId: 10 },
    ]);
    await expect(fetchOlxCategoryAttributes("token", 12)).resolves.toEqual([
      {
        code: "experience",
        label: "Опыт работы",
        unit: null,
        validation: {
          type: "attribute",
          required: true,
          numeric: true,
          min: 0,
          max: 50,
          allowMultipleValues: false,
        },
        values: [],
      },
    ]);
  });
});
