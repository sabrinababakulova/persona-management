import { and, eq } from "drizzle-orm";

import {
  companyFeatureFlags,
  companyTelegramResumeConfigs,
  vacancies,
} from "~/server/db/schema";
import { FEATURE_TELEGRAM_RESUME_WAREHOUSE } from "~/shared/feature-flags";

type DatabaseClient = typeof import("~/server/db").db;
type WarehouseDatabase = Pick<DatabaseClient, "insert" | "select">;

export const TELEGRAM_RESUME_WAREHOUSE_SYSTEM_KEY = "telegram_resume_warehouse";
export const TELEGRAM_RESUME_WAREHOUSE_TITLE = "Склад кандидатов из Telegram";

export type TelegramResumeWarehouse = {
  id: string;
  title: string;
  created: boolean;
};

function getDatabaseErrorCode(error: unknown): string {
  if (typeof error !== "object" || error === null) {
    return "";
  }
  if ("code" in error && error.code) {
    return String(error.code);
  }
  return "cause" in error ? getDatabaseErrorCode(error.cause) : "";
}

/**
 * Returns the company's system-owned Telegram warehouse without creating it.
 * The company predicate is mandatory even though system keys are unique per
 * company: callers must never obtain another tenant's internal vacancy.
 */
export async function getCompanyTelegramResumeWarehouse(
  database: WarehouseDatabase,
  companyId: string,
): Promise<Omit<TelegramResumeWarehouse, "created"> | null> {
  try {
    const [warehouse] = await database
      .select({ id: vacancies.id, title: vacancies.title })
      .from(vacancies)
      .where(
        and(
          eq(vacancies.companyId, companyId),
          eq(vacancies.systemKey, TELEGRAM_RESUME_WAREHOUSE_SYSTEM_KEY),
          eq(vacancies.isInternal, true),
          eq(vacancies.isPublication, false),
        ),
      )
      .limit(1);

    return warehouse ?? null;
  } catch (error) {
    if (getDatabaseErrorCode(error) !== "42703") {
      throw error;
    }

    // Rolling-deploy compatibility: before migration 0056 lands, an existing
    // Directus-era config is still a trustworthy pointer to this company's
    // warehouse. Writes continue to require the migrated system key.
    const [legacyWarehouse] = await database
      .select({ id: vacancies.id, title: vacancies.title })
      .from(companyTelegramResumeConfigs)
      .innerJoin(
        vacancies,
        eq(companyTelegramResumeConfigs.warehouseVacancyId, vacancies.id),
      )
      .where(
        and(
          eq(companyTelegramResumeConfigs.companyId, companyId),
          eq(vacancies.companyId, companyId),
          eq(vacancies.isInternal, true),
          eq(vacancies.isPublication, false),
        ),
      )
      .limit(1);

    return legacyWarehouse ?? null;
  }
}

/**
 * Idempotently provisions the internal vacancy used by Telegram ingestion and
 * enables the warehouse capability for the company. The partial unique index
 * on (companyId, systemKey) is the final race-condition guard.
 */
export async function ensureCompanyTelegramResumeWarehouse(
  database: WarehouseDatabase,
  companyId: string,
  options?: { title?: string },
): Promise<TelegramResumeWarehouse> {
  const existing = await getCompanyTelegramResumeWarehouse(database, companyId);

  let warehouse = existing;
  let created = false;

  if (!warehouse) {
    const id = crypto.randomUUID();
    const inserted = await database
      .insert(vacancies)
      .values({
        id,
        parentId: id,
        title: options?.title?.trim() || TELEGRAM_RESUME_WAREHOUSE_TITLE,
        status: "active",
        responses: 0,
        salaryCurrency: "UZS",
        companyId,
        isPublication: false,
        isInternal: true,
        systemKey: TELEGRAM_RESUME_WAREHOUSE_SYSTEM_KEY,
        isActive: false,
      })
      .onConflictDoNothing()
      .returning({ id: vacancies.id, title: vacancies.title });

    warehouse = inserted[0] ?? null;
    created = Boolean(warehouse);

    if (!warehouse) {
      warehouse = await getCompanyTelegramResumeWarehouse(database, companyId);
    }
  }

  if (!warehouse) {
    throw new Error("Failed to create the Telegram resume warehouse vacancy");
  }

  await database
    .insert(companyFeatureFlags)
    .values({
      companyId,
      feature: FEATURE_TELEGRAM_RESUME_WAREHOUSE,
      isEnabled: true,
    })
    .onConflictDoUpdate({
      target: [companyFeatureFlags.companyId, companyFeatureFlags.feature],
      set: { isEnabled: true },
    });

  return { ...warehouse, created };
}
