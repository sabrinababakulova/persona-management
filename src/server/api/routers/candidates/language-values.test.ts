import { describe, expect, test } from "bun:test";

import { resolveCandidateLanguageLabel } from "./language-values";

const LANGUAGE_OPTIONS = [
  { value: "russian", label: "Русский" },
  { value: "english", label: "Английский" },
];

describe("candidate language lookup normalization", () => {
  test("resolves a stable language value to the canonical label", () => {
    expect(resolveCandidateLanguageLabel("russian", LANGUAGE_OPTIONS)).toBe(
      "Русский",
    );
  });

  test("keeps legacy canonical labels compatible", () => {
    expect(resolveCandidateLanguageLabel("Русский", LANGUAGE_OPTIONS)).toBe(
      "Русский",
    );
  });

  test("rejects values missing from the lookup", () => {
    expect(
      resolveCandidateLanguageLabel("klingon", LANGUAGE_OPTIONS),
    ).toBeUndefined();
  });
});
