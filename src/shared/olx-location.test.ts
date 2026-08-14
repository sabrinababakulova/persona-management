import { describe, expect, test } from "bun:test";
import {
  resolveOlxLocationSearchQuery,
  sanitizeOlxLocationInput,
} from "./olx-location";

describe("OLX location input", () => {
  test("keeps supported Russian, English, and Uzbek characters", () => {
    expect(sanitizeOlxLocationInput(" Ташкент / Tashkent 123 🏢 ")).toBe(
      " Ташкент Tashkent ",
    );
    expect(sanitizeOlxLocationInput("Farg‘ona")).toBe("Farg‘ona");
    expect(sanitizeOlxLocationInput("طشقند")).toBe("");
  });

  test("maps common English city spellings to OLX-supported queries", () => {
    expect(resolveOlxLocationSearchQuery("Tashkent")).toBe("Toshkent");
    expect(resolveOlxLocationSearchQuery("Samarkand")).toBe("Samarqand");
    expect(resolveOlxLocationSearchQuery("Fergana")).toBe("Farg‘ona");
    expect(resolveOlxLocationSearchQuery("Ташкент")).toBe("Ташкент");
    expect(resolveOlxLocationSearchQuery("Toshkent")).toBe("Toshkent");
  });
});
