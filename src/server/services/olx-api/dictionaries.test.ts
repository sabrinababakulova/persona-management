import { describe, expect, test } from "bun:test";
import { parseOlxJobCategories, searchOlxLocations } from "./dictionaries";

function prerenderedHtml(state: unknown): string {
  const serialized = JSON.stringify(JSON.stringify(state));
  return `<script>window.__PRERENDERED_STATE__ = ${serialized};</script>`;
}

describe("OLX dictionaries", () => {
  test("extracts only selectable job categories and builds their paths", () => {
    const html = prerenderedHtml({
      categories: {
        list: {
          "6": {
            id: 6,
            parentId: 0,
            name: "Работа",
            type: "job",
            isAdding: true,
            children: [149],
          },
          "149": {
            id: 149,
            parentId: 6,
            name: "HR / офис",
            type: "job",
            isAdding: true,
            children: [],
          },
          "200": {
            id: 200,
            parentId: 0,
            name: "Не работа",
            type: "goods",
            isAdding: true,
            children: [],
          },
        },
      },
    });

    expect(parseOlxJobCategories(html)).toEqual([
      { id: 149, label: "HR / офис", path: ["Работа", "HR / офис"] },
    ]);
  });

  test("normalizes and deduplicates OLX location suggestions", async () => {
    let requestedUrl = "";
    const fetchImpl = async (input: URL | RequestInfo) => {
      requestedUrl = String(input);
      return Response.json({
        data: [
          {
            city: { id: 4, name: "Ташкент", lat: 41.3, lon: 69.2 },
            district: {
              id: 26,
              name: "Яккасарайский район",
              lat: 41.28,
              lon: 69.25,
            },
            region: { id: 5, name: "Ташкентская область " },
          },
          {
            city: { id: 4, name: "Ташкент", lat: 41.3, lon: 69.2 },
            district: {
              id: 26,
              name: "Яккасарайский район",
              lat: 41.28,
              lon: 69.25,
            },
            region: { id: 5, name: "Ташкентская область " },
          },
        ],
      });
    };

    expect(await searchOlxLocations("Tashkent", fetchImpl)).toEqual([
      {
        cityId: 4,
        cityName: "Ташкент",
        districtId: 26,
        districtName: "Яккасарайский район",
        regionId: 5,
        regionName: "Ташкентская область",
        latitude: 41.28,
        longitude: 69.25,
        label: "Ташкент, Яккасарайский район",
      },
    ]);
    expect(new URL(requestedUrl).searchParams.get("query")).toBe("Toshkent");
  });
});
