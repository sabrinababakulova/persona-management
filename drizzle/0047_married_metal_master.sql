CREATE TABLE "company_telegram_resume_config" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"company_id" varchar(255) NOT NULL,
	"chat_id" varchar(64) NOT NULL,
	"warehouse_vacancy_id" varchar(255) NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	"updatedAt" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "company_telegram_resume_config" ADD CONSTRAINT "company_telegram_resume_config_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_telegram_resume_config" ADD CONSTRAINT "company_telegram_resume_config_warehouse_vacancy_id_vacancy_id_fk" FOREIGN KEY ("warehouse_vacancy_id") REFERENCES "public"."vacancy"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "company_tg_resume_config_company_idx" ON "company_telegram_resume_config" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "company_tg_resume_config_chat_idx" ON "company_telegram_resume_config" USING btree ("chat_id");