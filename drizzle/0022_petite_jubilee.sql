ALTER TABLE "vacancy_telegram_post" DROP CONSTRAINT "vacancy_telegram_post_channel_id_company_telegram_channel_id_fk";
--> statement-breakpoint
ALTER TABLE "vacancy_telegram_post" ALTER COLUMN "channel_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "vacancy_telegram_post" ADD CONSTRAINT "vacancy_telegram_post_channel_id_company_telegram_channel_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."company_telegram_channel"("id") ON DELETE set null ON UPDATE no action;