CREATE TABLE "telegram_channel_admin" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"channel_id" varchar(255) NOT NULL,
	"telegram_username" varchar(255) NOT NULL,
	"name" varchar(255),
	"telegram_user_id" varchar(64),
	"activated_at" timestamp with time zone,
	"createdAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vacancy_telegram_dispatch" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"publication_id" varchar(255) NOT NULL,
	"channel_id" varchar(255),
	"admin_id" varchar(255),
	"admin_chat_id" varchar(64) NOT NULL,
	"bot_message_id" integer NOT NULL,
	"confirmed_at" timestamp with time zone,
	"createdAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "company_telegram_channel" DROP CONSTRAINT "company_telegram_channel_userId_user_id_fk";
--> statement-breakpoint
DROP INDEX "user_tg_channel_user_id_idx";--> statement-breakpoint
ALTER TABLE "company_telegram_channel" ALTER COLUMN "userId" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "company_telegram_channel" ADD COLUMN "company_id" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "company_telegram_channel" ADD COLUMN "created_by_user_id" varchar(255);--> statement-breakpoint
ALTER TABLE "company_telegram_channel" ADD COLUMN "title" varchar(255);--> statement-breakpoint
ALTER TABLE "company_telegram_channel" ADD COLUMN "delivery_mode" varchar(32) DEFAULT 'direct' NOT NULL;--> statement-breakpoint
ALTER TABLE "telegram_channel_admin" ADD CONSTRAINT "telegram_channel_admin_channel_id_company_telegram_channel_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."company_telegram_channel"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vacancy_telegram_dispatch" ADD CONSTRAINT "vacancy_telegram_dispatch_publication_id_vacancy_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."vacancy"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vacancy_telegram_dispatch" ADD CONSTRAINT "vacancy_telegram_dispatch_channel_id_company_telegram_channel_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."company_telegram_channel"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vacancy_telegram_dispatch" ADD CONSTRAINT "vacancy_telegram_dispatch_admin_id_telegram_channel_admin_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."telegram_channel_admin"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tg_channel_admin_channel_id_idx" ON "telegram_channel_admin" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "tg_channel_admin_username_idx" ON "telegram_channel_admin" USING btree ("telegram_username");--> statement-breakpoint
CREATE UNIQUE INDEX "tg_channel_admin_channel_username_key" ON "telegram_channel_admin" USING btree ("channel_id","telegram_username");--> statement-breakpoint
CREATE INDEX "vacancy_tg_dispatch_publication_id_idx" ON "vacancy_telegram_dispatch" USING btree ("publication_id");--> statement-breakpoint
CREATE INDEX "vacancy_tg_dispatch_admin_id_idx" ON "vacancy_telegram_dispatch" USING btree ("admin_id");--> statement-breakpoint
ALTER TABLE "company_telegram_channel" ADD CONSTRAINT "company_telegram_channel_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_telegram_channel" ADD CONSTRAINT "company_telegram_channel_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "company_tg_channel_company_id_idx" ON "company_telegram_channel" USING btree ("company_id");