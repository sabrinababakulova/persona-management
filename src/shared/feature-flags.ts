/**
 * Per-company feature flag keys stored in the `company_feature_flag` table
 * (edited through Directus). A feature is ON when an enabled row exists;
 * absence of a row means OFF.
 */
export const FEATURE_TELEGRAM_RESUME_WAREHOUSE = "telegram_resume_warehouse";
export const FEATURE_PERSON_HUNTER_PUBLICATIONS = "person_hunter_publications";

/**
 * Branded resume templates are granted per design key via rows like
 * `resume_design.person-hunters`. New designs need a new row, not a migration.
 */
export const RESUME_DESIGN_FEATURE_PREFIX = "resume_design.";
export const RESUME_DESIGN_PERSON_HUNTERS = "person-hunters";

export type BooleanFeatureKey =
  | typeof FEATURE_TELEGRAM_RESUME_WAREHOUSE
  | typeof FEATURE_PERSON_HUNTER_PUBLICATIONS;

export type CompanyFeatures = {
  canUseTelegramWarehouse: boolean;
  canPublishPersonHunter: boolean;
  /** Design keys of branded resume templates this company may render. */
  resumeDesigns: string[];
};
