CREATE TABLE "user_olx_session" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"encrypted_storage_state" text NOT NULL,
	"login_hint" varchar(255),
	"status" varchar(30) DEFAULT 'connected' NOT NULL,
	"last_verified_at" timestamp with time zone,
	"last_operation_at" timestamp with time zone,
	"last_error" text,
	"createdAt" timestamp with time zone NOT NULL,
	"updatedAt" timestamp with time zone,
	CONSTRAINT "user_olx_session_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "vacancy" ADD COLUMN "olx_advert_url" varchar(1000);--> statement-breakpoint
ALTER TABLE "vacancy" ADD COLUMN "olx_advert_id" varchar(100);--> statement-breakpoint
ALTER TABLE "vacancy" ADD COLUMN "olx_browser_meta" json;--> statement-breakpoint
ALTER TABLE "vacancy" ADD COLUMN "olx_last_published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "vacancy" ADD COLUMN "olx_last_error" text;--> statement-breakpoint
ALTER TABLE "user_olx_session" ADD CONSTRAINT "user_olx_session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vacancy_olx_advert_id_idx" ON "vacancy" USING btree ("olx_advert_id");