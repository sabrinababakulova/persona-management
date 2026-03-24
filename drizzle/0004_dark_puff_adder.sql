CREATE TABLE "company_hh_account" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"companyId" varchar(255) NOT NULL,
	"clientId" varchar(255),
	"clientSecret" varchar(500),
	"accessToken" text,
	"refreshToken" text,
	"employerId" varchar(255),
	"email" varchar(255),
	"createdAt" timestamp with time zone NOT NULL,
	"updatedAt" timestamp with time zone,
	CONSTRAINT "company_hh_account_companyId_unique" UNIQUE("companyId")
);
--> statement-breakpoint
CREATE TABLE "company_telegram_channel" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"companyId" varchar(255) NOT NULL,
	"channelId" varchar(255) NOT NULL,
	"label" varchar(255),
	"createdAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "company_hh_account" ADD CONSTRAINT "company_hh_account_companyId_company_id_fk" FOREIGN KEY ("companyId") REFERENCES "public"."company"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_telegram_channel" ADD CONSTRAINT "company_telegram_channel_companyId_company_id_fk" FOREIGN KEY ("companyId") REFERENCES "public"."company"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "company_tg_channel_company_id_idx" ON "company_telegram_channel" USING btree ("companyId");