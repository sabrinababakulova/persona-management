CREATE TABLE "vacancy_telegram_post" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"publication_id" varchar(255) NOT NULL,
	"channel_id" varchar(255) NOT NULL,
	"message_url" varchar(500) NOT NULL,
	"createdAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vacancy_telegram_post" ADD CONSTRAINT "vacancy_telegram_post_publication_id_vacancy_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."vacancy"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vacancy_telegram_post" ADD CONSTRAINT "vacancy_telegram_post_channel_id_company_telegram_channel_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."company_telegram_channel"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vacancy_tg_post_publication_id_idx" ON "vacancy_telegram_post" USING btree ("publication_id");