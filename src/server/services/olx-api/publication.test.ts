import { describe, expect, test } from "bun:test";
import type { OlxCredentials } from "./client";
import {
  buildOlxOfferPayload,
  htmlToOlxPlainText,
  type OlxAdvertInput,
  submitOlxOffer,
} from "./publication";

function jwt(payload: Record<string, unknown>): string {
  return [
    Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url"),
    Buffer.from(JSON.stringify(payload)).toString("base64url"),
    "unsigned-test-signature",
  ].join(".");
}

const credentials: OlxCredentials = {
  version: 1,
  source: "olx_ciam",
  accessToken: jwt({ exp: Math.floor(Date.now() / 1000) + 3_600 }),
  refreshToken: "refresh-token-value-that-is-long-enough",
  idToken: jwt({ sub: "test-user" }),
  deviceId: "test-device-id-123",
  fingerprint: "test-browser-fingerprint-123",
  cookieHeader: "deviceGUID=test-device; lang=ru",
  userAgent:
    "Mozilla/5.0 Test Browser AppleWebKit/537.36 Chrome/151.0.0.0 Safari/537.36",
  expiresAt: Date.now() + 3_600_000,
};

const advert: OlxAdvertInput = {
  title: "Менеджер по продажам в офис",
  descriptionHtml:
    "<p>Ищем менеджера по продажам в дружную команду.</p><p>Работа с клиентами, обучение и понятные условия.</p>",
  salaryFrom: 5_000_000,
  salaryTo: 8_000_000,
  salaryCurrency: "UZS",
  meta: {
    categoryId: 149,
    categoryPath: ["Работа", "HR / офис"],
    location: "Ташкент, Яккасарайский район",
    cityId: 4,
    cityName: "Ташкент",
    districtId: 26,
    districtName: "Яккасарайский район",
    regionId: 5,
    regionName: "Ташкентская область",
    latitude: 41.28,
    longitude: 69.25,
    employmentType: "perm",
    schedule: "full",
    contactName: "Тестовый рекрутер",
    contactPhone: "+998901234567",
    salaryNegotiable: false,
    remoteWork: true,
    onlineRecruitment: false,
  },
};

describe("OLX publication requests", () => {
  test("converts editor HTML to safe plain text", () => {
    expect(htmlToOlxPlainText("<p>Hello</p><ul><li>World</li></ul>")).toBe(
      "Hello\n• World",
    );
  });

  test("builds the same compact payload shape used by the OLX job wizard", async () => {
    const payload = await buildOlxOfferPayload(advert);

    expect(payload).toMatchObject({
      title: advert.title,
      category_id: 149,
      city_id: 4,
      district_id: 26,
      latitude: 41.28,
      longitude: 69.25,
      person: "Тестовый рекрутер",
      phone: "+998901234567",
      parameters: {
        job_type: "perm",
        salary: {
          from: "5000000",
          to: "8000000",
          arranged: 0,
          currency: "UZS",
        },
        job_timing: "full",
        remote_work: true,
      },
    });
    expect(payload.components_data).toEqual({
      reposting: {
        action: "ad_posted",
        data: '{"reposting":false}',
      },
    });
  });

  test("previews with one authenticated request and never creates an advert", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = async (input: URL | RequestInfo, init?: RequestInit) => {
      calls.push({ url: String(input), init });
      return Response.json({ data: { title: advert.title } });
    };

    const submitted = await submitOlxOffer({
      credentials,
      advert,
      dryRun: true,
      fetchImpl,
    });

    expect(submitted.result).toEqual({ mode: "preview" });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("https://www.olx.uz/api/v1/offers-preview");
    expect(calls[0]?.init?.method).toBe("POST");
    expect(new Headers(calls[0]?.init?.headers).get("posting-id")).toBeTruthy();
  });

  test("creates once and resolves the public URL without resubmitting", async () => {
    const calls: string[] = [];
    const fetchImpl = async (input: URL | RequestInfo) => {
      calls.push(String(input));
      return calls.length === 1
        ? Response.json({ data: { id: 65713044 } })
        : Response.json({
            data: {
              id: 65713044,
              url: "https://www.olx.uz/obyavlenie/rabota/test-IDabc.html",
            },
          });
    };

    const submitted = await submitOlxOffer({
      credentials,
      advert,
      dryRun: false,
      fetchImpl,
    });

    expect(calls).toEqual([
      "https://www.olx.uz/api/v1/offers",
      "https://www.olx.uz/api/v1/offers/65713044",
    ]);
    expect(submitted.result).toEqual({
      mode: "published",
      advertId: "65713044",
      advertUrl: "https://www.olx.uz/obyavlenie/rabota/test-IDabc.html",
    });
  });
});
