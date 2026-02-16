-- This migration captures schema state from manually-created migrations 0004 and 0005.
-- All statements use IF NOT EXISTS / IF NOT EXISTS to be idempotent.

CREATE TABLE IF NOT EXISTS "persona-management_recent_activity_log" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"entityType" varchar(50) NOT NULL,
	"entityId" varchar(255) NOT NULL,
	"actorUserId" varchar(255),
	"actorName" varchar(255) NOT NULL,
	"action" varchar(255) NOT NULL,
	"targetName" varchar(255) NOT NULL,
	"targetStatus" varchar(255) NOT NULL,
	"createdAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "persona-management_user" ADD COLUMN IF NOT EXISTS "password" varchar(255);--> statement-breakpoint
ALTER TABLE "persona-management_user" ADD COLUMN IF NOT EXISTS "hasSeenWelcomeModal" boolean DEFAULT true NOT NULL;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "persona-management_recent_activity_log" ADD CONSTRAINT "persona-management_recent_activity_log_actorUserId_persona-management_user_id_fk" FOREIGN KEY ("actorUserId") REFERENCES "public"."persona-management_user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "recent_activity_created_at_idx" ON "persona-management_recent_activity_log" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "recent_activity_entity_idx" ON "persona-management_recent_activity_log" USING btree ("entityType","entityId");--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "persona-management_user" ADD CONSTRAINT "persona-management_user_email_unique" UNIQUE("email");
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
