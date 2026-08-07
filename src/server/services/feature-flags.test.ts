import { describe, expect, test } from "bun:test";

import {
  FEATURE_PERSON_HUNTER_PUBLICATIONS,
  FEATURE_TELEGRAM_RESUME_WAREHOUSE,
} from "~/shared/feature-flags";

import { resolveCompanyFeatures } from "./feature-flags";

describe("resolveCompanyFeatures", () => {
  test("returns everything disabled for no rows", () => {
    expect(resolveCompanyFeatures([])).toEqual({
      canUseTelegramWarehouse: false,
      canPublishPersonHunter: false,
      resumeDesigns: [],
    });
  });

  test("maps boolean feature keys to their capabilities", () => {
    const features = resolveCompanyFeatures([
      { feature: FEATURE_TELEGRAM_RESUME_WAREHOUSE, isEnabled: true },
      { feature: FEATURE_PERSON_HUNTER_PUBLICATIONS, isEnabled: true },
    ]);

    expect(features.canUseTelegramWarehouse).toBe(true);
    expect(features.canPublishPersonHunter).toBe(true);
  });

  test("ignores rows toggled off in Directus", () => {
    const features = resolveCompanyFeatures([
      { feature: FEATURE_TELEGRAM_RESUME_WAREHOUSE, isEnabled: false },
      { feature: "resume_design.person-hunters", isEnabled: false },
    ]);

    expect(features.canUseTelegramWarehouse).toBe(false);
    expect(features.resumeDesigns).toEqual([]);
  });

  test("collects resume design keys from prefixed rows", () => {
    const features = resolveCompanyFeatures([
      { feature: "resume_design.person-hunters", isEnabled: true },
      { feature: "resume_design.acme", isEnabled: true },
      { feature: "resume_design.person-hunters", isEnabled: true },
    ]);

    expect(features.resumeDesigns).toEqual(["person-hunters", "acme"]);
  });

  test("ignores unknown keys and empty design suffixes", () => {
    const features = resolveCompanyFeatures([
      { feature: "totally_unknown", isEnabled: true },
      { feature: "resume_design.", isEnabled: true },
    ]);

    expect(features).toEqual({
      canUseTelegramWarehouse: false,
      canPublishPersonHunter: false,
      resumeDesigns: [],
    });
  });
});
