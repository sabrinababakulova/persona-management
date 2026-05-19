ALTER TABLE "vacancy_telegram_post" DROP CONSTRAINT IF EXISTS "vacancy_telegram_post_channel_id_company_telegram_channel_id_fk";
--> statement-breakpoint
ALTER TABLE "company_telegram_channel" DROP CONSTRAINT IF EXISTS "company_telegram_channel_companyId_company_id_fk";
--> statement-breakpoint
ALTER TABLE "company_hh_account" DROP CONSTRAINT IF EXISTS "company_hh_account_companyId_company_id_fk";
--> statement-breakpoint
ALTER TABLE "company_hh_account" DROP CONSTRAINT IF EXISTS "company_hh_account_companyId_unique";
--> statement-breakpoint
DROP INDEX IF EXISTS "company_tg_channel_company_id_idx";
--> statement-breakpoint
ALTER TABLE "company_telegram_channel" ADD COLUMN "userId" varchar(255);
--> statement-breakpoint
UPDATE "company_telegram_channel" AS "channel"
SET "userId" = "owner"."id"
FROM (
	SELECT DISTINCT ON ("companyId") "id", "companyId"
	FROM "user"
	WHERE "companyId" IS NOT NULL
	ORDER BY "companyId", "id"
) AS "owner"
WHERE "channel"."companyId" = "owner"."companyId";
--> statement-breakpoint
UPDATE "vacancy_telegram_post"
SET "channel_id" = NULL
WHERE "channel_id" IN (
	SELECT "id"
	FROM "company_telegram_channel"
	WHERE "userId" IS NULL
);
--> statement-breakpoint
DELETE FROM "company_telegram_channel" WHERE "userId" IS NULL;
--> statement-breakpoint
ALTER TABLE "company_telegram_channel" DROP COLUMN "companyId";
--> statement-breakpoint
ALTER TABLE "company_telegram_channel" ALTER COLUMN "userId" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "company_telegram_channel" ADD CONSTRAINT "company_telegram_channel_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "user_tg_channel_user_id_idx" ON "company_telegram_channel" USING btree ("userId");
--> statement-breakpoint
ALTER TABLE "vacancy_telegram_post" ADD CONSTRAINT "vacancy_telegram_post_channel_id_user_telegram_channel_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."company_telegram_channel"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "company_hh_account" ADD COLUMN "userId" varchar(255);
--> statement-breakpoint
UPDATE "company_hh_account" AS "account"
SET "userId" = "owner"."id"
FROM (
	SELECT DISTINCT ON ("companyId") "id", "companyId"
	FROM "user"
	WHERE "companyId" IS NOT NULL
	ORDER BY "companyId", "id"
) AS "owner"
WHERE "account"."companyId" = "owner"."companyId";
--> statement-breakpoint
DELETE FROM "company_hh_account" WHERE "userId" IS NULL;
--> statement-breakpoint
ALTER TABLE "company_hh_account" DROP COLUMN "companyId";
--> statement-breakpoint
ALTER TABLE "company_hh_account" ALTER COLUMN "userId" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "company_hh_account" ADD CONSTRAINT "company_hh_account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "company_hh_account" ADD CONSTRAINT "company_hh_account_userId_unique" UNIQUE("userId");
