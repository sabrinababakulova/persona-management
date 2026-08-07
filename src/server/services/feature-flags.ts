import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";

import { companyFeatureFlags } from "~/server/db/schema";
import {
  type BooleanFeatureKey,
  type CompanyFeatures,
  FEATURE_PERSON_HUNTER_PUBLICATIONS,
  FEATURE_TELEGRAM_RESUME_WAREHOUSE,
  RESUME_DESIGN_FEATURE_PREFIX,
} from "~/shared/feature-flags";

type DatabaseClient = typeof import("~/server/db").db;

const FEATURE_DISABLED_MESSAGES: Record<BooleanFeatureKey, string> = {
  [FEATURE_TELEGRAM_RESUME_WAREHOUSE]:
    "Склад кандидатов недоступен для вашей компании",
  [FEATURE_PERSON_HUNTER_PUBLICATIONS]:
    "Публикации на PersonHunters недоступны для вашей компании",
};

/** Pure resolver over flag rows — unknown keys are ignored. */
export function resolveCompanyFeatures(
  rows: { feature: string; isEnabled: boolean }[],
): CompanyFeatures {
  const features: CompanyFeatures = {
    canUseTelegramWarehouse: false,
    canPublishPersonHunter: false,
    resumeDesigns: [],
  };

  for (const row of rows) {
    if (!row.isEnabled) {
      continue;
    }
    if (row.feature === FEATURE_TELEGRAM_RESUME_WAREHOUSE) {
      features.canUseTelegramWarehouse = true;
    } else if (row.feature === FEATURE_PERSON_HUNTER_PUBLICATIONS) {
      features.canPublishPersonHunter = true;
    } else if (row.feature.startsWith(RESUME_DESIGN_FEATURE_PREFIX)) {
      const designKey = row.feature.slice(RESUME_DESIGN_FEATURE_PREFIX.length);
      if (designKey && !features.resumeDesigns.includes(designKey)) {
        features.resumeDesigns.push(designKey);
      }
    }
  }

  return features;
}

/**
 * Loads the feature set of a company. One indexed select; deliberately
 * uncached so Directus edits apply on the next request.
 */
export async function getCompanyFeatures(
  database: DatabaseClient,
  companyId: string,
): Promise<CompanyFeatures> {
  const rows = await database
    .select({
      feature: companyFeatureFlags.feature,
      isEnabled: companyFeatureFlags.isEnabled,
    })
    .from(companyFeatureFlags)
    .where(
      and(
        eq(companyFeatureFlags.companyId, companyId),
        eq(companyFeatureFlags.isEnabled, true),
      ),
    );

  return resolveCompanyFeatures(rows);
}

/** tRPC-side guard mirroring `requireCompanyAdmin`. */
export async function requireCompanyFeature(
  database: DatabaseClient,
  companyId: string,
  feature: BooleanFeatureKey,
): Promise<void> {
  const features = await getCompanyFeatures(database, companyId);
  const enabled =
    feature === FEATURE_TELEGRAM_RESUME_WAREHOUSE
      ? features.canUseTelegramWarehouse
      : features.canPublishPersonHunter;

  if (!enabled) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: FEATURE_DISABLED_MESSAGES[feature],
    });
  }
}
