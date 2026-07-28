CREATE TABLE "telegram_resume_import" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"company_id" varchar(255) NOT NULL,
	"chat_id" varchar(64) NOT NULL,
	"message_id" integer NOT NULL,
	"update_id" varchar(64),
	"source" varchar(30) DEFAULT 'bot' NOT NULL,
	"file_id" varchar(255),
	"file_unique_id" varchar(255) NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"mime_type" varchar(255),
	"file_size" integer,
	"message_date" timestamp with time zone,
	"candidate_id" varchar(255) NOT NULL,
	"resume_file_id" varchar(255),
	"prefill_data" json,
	"ai_analysis" text,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"run_after" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"last_error" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "telegram_resume_import" ADD CONSTRAINT "telegram_resume_import_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "telegram_resume_import_message_idx" ON "telegram_resume_import" USING btree ("chat_id","message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "telegram_resume_import_file_idx" ON "telegram_resume_import" USING btree ("company_id","file_unique_id");--> statement-breakpoint
CREATE INDEX "telegram_resume_import_claim_idx" ON "telegram_resume_import" USING btree ("status","run_after");--> statement-breakpoint
CREATE INDEX "telegram_resume_import_company_idx" ON "telegram_resume_import" USING btree ("company_id");