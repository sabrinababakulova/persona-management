CREATE TABLE "user_olx_account" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"userId" varchar(255) NOT NULL,
	"olx_user_id" varchar(100) NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"access_token_expires_at" timestamp with time zone,
	"scope" text,
	"email" varchar(255),
	"name" varchar(255),
	"phone" varchar(50),
	"is_business" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	"updatedAt" timestamp with time zone,
	CONSTRAINT "user_olx_account_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
ALTER TABLE "vacancy" ADD COLUMN "olx_advert_id" varchar(100);--> statement-breakpoint
ALTER TABLE "vacancy" ADD COLUMN "olx_advert_url" varchar(500);--> statement-breakpoint
ALTER TABLE "vacancy" ADD COLUMN "olx_advert_status" varchar(50);--> statement-breakpoint
ALTER TABLE "vacancy" ADD COLUMN "olx_meta" json;--> statement-breakpoint
ALTER TABLE "user_olx_account" ADD CONSTRAINT "user_olx_account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vacancy_olx_advert_id_idx" ON "vacancy" USING btree ("olx_advert_id");