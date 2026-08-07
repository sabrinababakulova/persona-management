import * as schema from "~/server/db/schema";
import { DEFAULT_COMPANY_ID } from "~/shared/default-company";
import {
  FEATURE_PERSON_HUNTER_PUBLICATIONS,
  FEATURE_TELEGRAM_RESUME_WAREHOUSE,
  RESUME_DESIGN_FEATURE_PREFIX,
  RESUME_DESIGN_PERSON_HUNTERS,
} from "~/shared/feature-flags";

import type { SeedDb } from "../../seed-utils";

/**
 * Grants the Person Hunters feature set to the dev default company.
 * Production grants are made manually in Directus (company_feature_flag).
 */
const PERSON_HUNTERS_FEATURES = [
  FEATURE_TELEGRAM_RESUME_WAREHOUSE,
  FEATURE_PERSON_HUNTER_PUBLICATIONS,
  `${RESUME_DESIGN_FEATURE_PREFIX}${RESUME_DESIGN_PERSON_HUNTERS}`,
];

export async function seedFeatureFlags(db: SeedDb) {
  for (const feature of PERSON_HUNTERS_FEATURES) {
    await db
      .insert(schema.companyFeatureFlags)
      .values({
        id: `${DEFAULT_COMPANY_ID}:${feature}`,
        companyId: DEFAULT_COMPANY_ID,
        feature,
        isEnabled: true,
      })
      .onConflictDoUpdate({
        target: [
          schema.companyFeatureFlags.companyId,
          schema.companyFeatureFlags.feature,
        ],
        set: { isEnabled: true },
      });
  }
  console.log(
    `Seeded company feature flags: ${PERSON_HUNTERS_FEATURES.length} rows`,
  );
}
