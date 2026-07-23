import { afterEach, describe, expect, test } from "bun:test";

import {
  createOrUpdateOlxAdvert,
  deleteOlxAdvert,
  isOlxAdvertActive,
  type OlxAdvertPayload,
  prepareOlxAdvertPayload,
  sanitizeOlxJobDescription,
} from "./adverts";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const description =
  "Мы ищем внимательного специалиста для работы с клиентами. Предлагаем официальное оформление, обучение и понятный график.";

function payload(): OlxAdvertPayload {
  return {
    title: "Оператор call-центра",
    description,
    category_id: 12,
    advertiser_type: "business",
    external_id: "publication-1",
    contact: {
      name: "Анна",
      phone: "+998901234567",
    },
    location: {
      city_id: 34,
    },
    attributes: [{ code: "type", value: "full-time" }],
    auto_extend_enabled: false,
  };
}

describe("prepareOlxAdvertPayload", () => {
  test("sanitizes job HTML and removes empty attributes", () => {
    const prepared = prepareOlxAdvertPayload({
      ...payload(),
      title: "  Оператор call-центра  ",
      description: `<p>${description}</p><img src="bad"><script>alert(1)</script>`,
      contact: { name: "  Анна  ", phone: "  +998901234567  " },
      attributes: [{ code: "type", value: "full-time" }, { code: "empty" }],
    });

    expect(prepared.title).toBe("Оператор call-центра");
    expect(prepared.description).toBe(`<p>${description}</p>`);
    expect(prepared.contact).toEqual({
      name: "Анна",
      phone: "+998901234567",
    });
    expect(prepared.attributes).toEqual([{ code: "type", value: "full-time" }]);
  });

  test("allows only OLX-supported job description tags", () => {
    expect(
      sanitizeOlxJobDescription(
        "<h2>Заголовок</h2><p><strong>Текст</strong><br>Строка</p>",
      ),
    ).toBe("Заголовок<p><strong>Текст</strong>Строка</p>");
  });
});

describe("createOrUpdateOlxAdvert", () => {
  test("finds an existing advert by external_id before updating", async () => {
    const requests: Array<{ url: string; method: string }> = [];
    globalThis.fetch = (async (input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      requests.push({ url, method });
      const body =
        method === "GET"
          ? [
              {
                id: 99,
                status: "active",
                title: "Old",
                external_id: "publication-1",
              },
            ]
          : {
              id: 99,
              status: "active",
              title: "Оператор call-центра",
              external_id: "publication-1",
              url: "https://www.olx.uz/d/obyavlenie/test-ID1.html",
            };
      return new Response(JSON.stringify(body), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }) as typeof fetch;

    const advert = await createOrUpdateOlxAdvert({
      accessToken: "token",
      payload: payload(),
    });

    expect(advert.id).toBe("99");
    expect(requests).toHaveLength(2);
    expect(requests[0]?.url).toContain("/adverts?external_id=publication-1");
    expect(requests[1]).toMatchObject({
      method: "PUT",
      url: "https://www.olx.uz/api/partner/adverts/99",
    });
  });

  test("creates an advert when external_id is not found", async () => {
    const methods: string[] = [];
    globalThis.fetch = (async (_input, init) => {
      const method = init?.method ?? "GET";
      methods.push(method);
      return new Response(
        JSON.stringify(
          method === "GET"
            ? []
            : {
                id: 100,
                status: "new",
                title: "Оператор call-центра",
                external_id: "publication-1",
              },
        ),
        {
          headers: { "Content-Type": "application/json" },
          status: 200,
        },
      );
    }) as typeof fetch;

    const advert = await createOrUpdateOlxAdvert({
      accessToken: "token",
      payload: payload(),
    });

    expect(advert.id).toBe("100");
    expect(methods).toEqual(["GET", "POST"]);
  });
});

describe("deleteOlxAdvert", () => {
  test("deactivates an active advert before deleting it", async () => {
    const requests: Array<{ method: string; body: unknown }> = [];
    globalThis.fetch = (async (_input, init) => {
      const method = init?.method ?? "GET";
      requests.push({
        method,
        body: typeof init?.body === "string" ? JSON.parse(init.body) : null,
      });
      if (method === "GET") {
        return new Response(
          JSON.stringify({
            id: 88,
            status: "active",
            title: "Оператор call-центра",
          }),
          {
            headers: { "Content-Type": "application/json" },
            status: 200,
          },
        );
      }
      return new Response(null, { status: 204 });
    }) as typeof fetch;

    await deleteOlxAdvert("token", "88");

    expect(requests).toEqual([
      { method: "GET", body: null },
      {
        method: "POST",
        body: { command: "deactivate", is_success: false },
      },
      { method: "DELETE", body: null },
    ]);
  });
});

describe("isOlxAdvertActive", () => {
  test("only treats the canonical active state as active", () => {
    expect(isOlxAdvertActive("active")).toBe(true);
    expect(isOlxAdvertActive("new")).toBe(false);
    expect(isOlxAdvertActive("limited")).toBe(false);
  });
});
