DROP INDEX "user_company_admin_idx";--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "deactivatedAt" timestamp with time zone;