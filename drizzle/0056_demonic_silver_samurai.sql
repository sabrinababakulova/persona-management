ALTER TABLE "vacancy" ADD COLUMN "system_key" varchar(100);--> statement-breakpoint
UPDATE "vacancy" AS "warehouse"
SET "system_key" = 'telegram_resume_warehouse',
    "is_internal" = true,
    "is_publication" = false,
    "is_active" = false
FROM "company_telegram_resume_config" AS "config"
WHERE "config"."warehouse_vacancy_id" = "warehouse"."id"
  AND "config"."company_id" = "warehouse"."companyId";--> statement-breakpoint
INSERT INTO "vacancy" (
  "id",
  "parentId",
  "title",
  "status",
  "responses",
  "salaryCurrency",
  "companyId",
  "is_publication",
  "is_internal",
  "system_key",
  "is_active",
  "createdAt"
)
SELECT
  'telegram-warehouse-' || md5("company"."id"),
  'telegram-warehouse-' || md5("company"."id"),
  'Склад кандидатов из Telegram',
  'active',
  0,
  'UZS',
  "company"."id",
  false,
  true,
  'telegram_resume_warehouse',
  false,
  now()
FROM "company"
WHERE NOT EXISTS (
  SELECT 1
  FROM "vacancy"
  WHERE "vacancy"."companyId" = "company"."id"
    AND "vacancy"."system_key" = 'telegram_resume_warehouse'
)
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint
INSERT INTO "company_feature_flag" (
  "id",
  "company_id",
  "feature",
  "is_enabled",
  "createdAt"
)
SELECT
  'telegram-warehouse-flag-' || md5("company"."id"),
  "company"."id",
  'telegram_resume_warehouse',
  true,
  now()
FROM "company"
ON CONFLICT ("company_id", "feature")
DO UPDATE SET "is_enabled" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "vacancy_company_system_key_idx" ON "vacancy" USING btree ("companyId","system_key") WHERE "vacancy"."system_key" is not null;--> statement-breakpoint
CREATE OR REPLACE FUNCTION "create_company_telegram_resume_warehouse"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  warehouse_id varchar(255) := 'telegram-warehouse-' || md5(NEW."id");
BEGIN
  INSERT INTO "vacancy" (
    "id",
    "parentId",
    "title",
    "status",
    "responses",
    "salaryCurrency",
    "companyId",
    "is_publication",
    "is_internal",
    "system_key",
    "is_active",
    "createdAt"
  ) VALUES (
    warehouse_id,
    warehouse_id,
    'Склад кандидатов из Telegram',
    'active',
    0,
    'UZS',
    NEW."id",
    false,
    true,
    'telegram_resume_warehouse',
    false,
    now()
  )
  ON CONFLICT ("companyId", "system_key")
    WHERE "system_key" IS NOT NULL
  DO NOTHING;

  INSERT INTO "company_feature_flag" (
    "id",
    "company_id",
    "feature",
    "is_enabled",
    "createdAt"
  ) VALUES (
    'telegram-warehouse-flag-' || md5(NEW."id"),
    NEW."id",
    'telegram_resume_warehouse',
    true,
    now()
  )
  ON CONFLICT ("company_id", "feature")
  DO UPDATE SET "is_enabled" = true;

  RETURN NEW;
END;
$$;--> statement-breakpoint
DROP TRIGGER IF EXISTS "company_telegram_resume_warehouse_after_insert" ON "company";--> statement-breakpoint
CREATE TRIGGER "company_telegram_resume_warehouse_after_insert"
AFTER INSERT ON "company"
FOR EACH ROW
EXECUTE FUNCTION "create_company_telegram_resume_warehouse"();
