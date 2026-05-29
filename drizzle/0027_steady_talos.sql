CREATE TABLE "hh_enrichment_job" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"candidate_id" varchar(255) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"run_after" timestamp with time zone NOT NULL,
	"locked_at" timestamp with time zone,
	"last_error" text,
	"createdAt" timestamp with time zone NOT NULL,
	"updatedAt" timestamp with time zone,
	CONSTRAINT "hh_enrichment_job_candidate_id_unique" UNIQUE("candidate_id")
);
--> statement-breakpoint
CREATE TABLE "hh_vacancy_sync_state" (
	"vacancy_id" varchar(255) PRIMARY KEY NOT NULL,
	"last_negotiation_at" timestamp with time zone,
	"last_sync_started_at" timestamp with time zone,
	"last_sync_finished_at" timestamp with time zone,
	"last_sync_error" text
);
--> statement-breakpoint
ALTER TABLE "vacancy_candidate" ADD COLUMN "hh_negotiation_id" varchar(100);--> statement-breakpoint
ALTER TABLE "vacancy_candidate" ADD COLUMN "stage" varchar(50) DEFAULT 'new' NOT NULL;--> statement-breakpoint
ALTER TABLE "vacancy_candidate" ADD COLUMN "hh_stage" varchar(50);--> statement-breakpoint
ALTER TABLE "vacancy_candidate" ADD COLUMN "application_state" varchar(20) DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "vacancy_candidate" ADD COLUMN "applied_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "vacancy_candidate" ADD COLUMN "createdAt" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "vacancy_candidate" ADD COLUMN "updatedAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "candidate" ADD COLUMN "hh_resume_id" varchar(100);--> statement-breakpoint
ALTER TABLE "candidate" ADD COLUMN "hh_resume_url" varchar(500);--> statement-breakpoint
ALTER TABLE "candidate" ADD COLUMN "hh_resume_fetched_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "candidate" ADD COLUMN "hh_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "candidate" ADD COLUMN "profile_locked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Backfill: legacy hh.uz candidates were stored with primary key `hh_<resumeId>`.
-- Populate `hh_resume_id` so the new (companyId, hh_resume_id) unique index and the
-- sync upsert recognise them instead of creating duplicates.
UPDATE "candidate" SET "hh_resume_id" = substring("id" from 4)
  WHERE "id" LIKE 'hh\_%' AND "source" = 'hh.uz' AND "hh_resume_id" IS NULL;--> statement-breakpoint
ALTER TABLE "hh_enrichment_job" ADD CONSTRAINT "hh_enrichment_job_candidate_id_candidate_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidate"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hh_vacancy_sync_state" ADD CONSTRAINT "hh_vacancy_sync_state_vacancy_id_vacancy_id_fk" FOREIGN KEY ("vacancy_id") REFERENCES "public"."vacancy"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hh_enrichment_job_claim_idx" ON "hh_enrichment_job" USING btree ("status","run_after");--> statement-breakpoint
CREATE UNIQUE INDEX "vacancy_candidate_hh_negotiation_idx" ON "vacancy_candidate" USING btree ("vacancy_id","hh_negotiation_id") WHERE "vacancy_candidate"."hh_negotiation_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "candidate_hh_resume_id_idx" ON "candidate" USING btree ("companyId","hh_resume_id") WHERE "candidate"."hh_resume_id" is not null;