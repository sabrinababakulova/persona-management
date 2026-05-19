CREATE TABLE "ai_usage_log" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255),
	"company_id" varchar(255),
	"candidate_id" varchar(255),
	"provider" varchar(50) DEFAULT 'google' NOT NULL,
	"model" varchar(100) NOT NULL,
	"agent" varchar(100) NOT NULL,
	"operation" varchar(100) NOT NULL,
	"status" varchar(50) NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"total_tokens" integer DEFAULT 0 NOT NULL,
	"reasoning_tokens" integer DEFAULT 0 NOT NULL,
	"cached_input_tokens" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_usage_log" ADD CONSTRAINT "ai_usage_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_log" ADD CONSTRAINT "ai_usage_log_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_usage_log_created_at_idx" ON "ai_usage_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ai_usage_log_company_id_idx" ON "ai_usage_log" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "ai_usage_log_user_id_idx" ON "ai_usage_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ai_usage_log_candidate_id_idx" ON "ai_usage_log" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "ai_usage_log_agent_idx" ON "ai_usage_log" USING btree ("agent");