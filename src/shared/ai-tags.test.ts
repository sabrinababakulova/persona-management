import { describe, expect, test } from "bun:test";

import { countAiTagWords, normalizeAiTag, normalizeAiTags } from "./ai-tags";

describe("AI tags", () => {
  test("limits sentence-like labels to four words", () => {
    expect(
      normalizeAiTag(
        "Надежные протоколы аутентификации, авторизации и безопасности данных",
      ),
    ).toBe("Надежные протоколы аутентификации, авторизации");
    expect(countAiTagWords(normalizeAiTag("one two three four five"))).toBe(4);
  });

  test("removes badge icons and dangling connectors", () => {
    expect(
      normalizeAiTag("✓ Разработка серверных приложений и API платформы"),
    ).toBe("Разработка серверных приложений");
  });

  test("deduplicates and limits tag arrays", () => {
    expect(
      normalizeAiTags([" Backend ", "backend", "PostgreSQL", "Senior", "API"]),
    ).toEqual(["Backend", "PostgreSQL", "Senior"]);
  });
});
