ALTER TABLE "ai_usage_log" ADD COLUMN "input_rate_usd_per_million" numeric(12, 6) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_usage_log" ADD COLUMN "output_rate_usd_per_million" numeric(12, 6) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_usage_log" ADD COLUMN "input_cost_usd" numeric(14, 8) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_usage_log" ADD COLUMN "output_cost_usd" numeric(14, 8) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_usage_log" ADD COLUMN "total_cost_usd" numeric(14, 8) DEFAULT '0' NOT NULL;