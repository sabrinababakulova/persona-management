ALTER TABLE "vacancy" ADD COLUMN "olx_posting_id" varchar(100);--> statement-breakpoint
ALTER TABLE "vacancy" ADD COLUMN "olx_publication_state" varchar(30);--> statement-breakpoint
ALTER TABLE "vacancy" ADD COLUMN "olx_publish_claimed_at" timestamp with time zone;--> statement-breakpoint
UPDATE "vacancy"
SET "olx_publication_state" = 'succeeded'
WHERE "destination" = 'olx.uz'
  AND ("olx_advert_id" IS NOT NULL OR "olx_advert_url" IS NOT NULL);--> statement-breakpoint
CREATE UNIQUE INDEX "vacancy_olx_posting_id_idx" ON "vacancy" USING btree ("olx_posting_id");
