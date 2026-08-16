import { describe, expect, test } from "bun:test";

import { getLocalizedStringList, getLocalizedText } from "./localized-ai";

describe("localized AI output", () => {
  const translations = {
    ru: "Русский текст",
    en: "English text",
    uz: "O'zbekcha matn",
  };

  test("selects the active platform locale", () => {
    expect(getLocalizedText(translations, "ru")).toBe("Русский текст");
    expect(getLocalizedText(translations, "en")).toBe("English text");
    expect(getLocalizedText(translations, "uz")).toBe("O'zbekcha matn");
  });

  test("falls back to legacy Russian text", () => {
    expect(getLocalizedText(undefined, "en", "Старый анализ")).toBe(
      "Старый анализ",
    );
  });

  test("selects and cleans localized requirement lists", () => {
    expect(
      getLocalizedStringList(
        {
          ru: ["React"],
          en: [" React experience ", ""],
          uz: ["React tajribasi"],
        },
        "en",
      ),
    ).toEqual(["React experience"]);
  });
});
