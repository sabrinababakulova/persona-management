-- `company.createdAt` is NOT NULL with an application-level default only, so the
-- column has no DB default to fall back on: it must be supplied explicitly here or
-- this statement fails on a database that is built from the migrations alone.
INSERT INTO "company" ("id", "name", "createdAt")
VALUES ('00000000-0000-0000-0000-000000000001', 'Default Company', now())
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
UPDATE "user"
SET "companyId" = '00000000-0000-0000-0000-000000000001'
WHERE "companyId" IS NULL;
--> statement-breakpoint
UPDATE "candidate"
SET "companyId" = '00000000-0000-0000-0000-000000000001'
WHERE "companyId" IS NULL;
--> statement-breakpoint
UPDATE "vacancy"
SET "companyId" = '00000000-0000-0000-0000-000000000001'
WHERE "companyId" IS NULL;
--> statement-breakpoint
ALTER TABLE "recent_activity_log" ADD COLUMN "companyId" varchar(255);
--> statement-breakpoint
UPDATE "recent_activity_log" AS "activity"
SET "companyId" = "candidate"."companyId"
FROM "candidate"
WHERE "activity"."entityType" = 'candidate'
  AND "activity"."entityId" = "candidate"."id";
--> statement-breakpoint
UPDATE "recent_activity_log" AS "activity"
SET "companyId" = "vacancy"."companyId"
FROM "vacancy"
WHERE "activity"."entityType" = 'vacancy'
  AND "activity"."entityId" = "vacancy"."id";
--> statement-breakpoint
DELETE FROM "recent_activity_log"
WHERE "companyId" IS NULL;
--> statement-breakpoint
ALTER TABLE "recent_activity_log" ALTER COLUMN "companyId" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "recent_activity_log" ADD CONSTRAINT "recent_activity_log_companyId_company_id_fk" FOREIGN KEY ("companyId") REFERENCES "public"."company"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "recent_activity_company_id_idx" ON "recent_activity_log" USING btree ("companyId");
