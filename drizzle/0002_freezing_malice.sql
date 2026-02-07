CREATE TABLE "persona-management_vacancy" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"level" varchar(100),
	"status" varchar(50) DEFAULT 'active',
	"city" varchar(255),
	"responses" integer DEFAULT 0,
	"workType" varchar(100),
	"createdAt" timestamp with time zone NOT NULL,
	"updatedAt" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "persona-management_candidate" ADD COLUMN "resumeFileSize" varchar(50);--> statement-breakpoint
ALTER TABLE "persona-management_candidate" ADD COLUMN "experience" varchar(255);--> statement-breakpoint
ALTER TABLE "persona-management_candidate" ADD COLUMN "matchScore" integer;--> statement-breakpoint
ALTER TABLE "persona-management_candidate" ADD COLUMN "tags" json DEFAULT '[]'::json;--> statement-breakpoint
ALTER TABLE "persona-management_candidate" ADD COLUMN "workExperience" json DEFAULT '[]'::json;--> statement-breakpoint
ALTER TABLE "persona-management_candidate" ADD COLUMN "education" json DEFAULT '[]'::json;--> statement-breakpoint
ALTER TABLE "persona-management_candidate" ADD COLUMN "notes" json DEFAULT '[]'::json;--> statement-breakpoint
ALTER TABLE "persona-management_candidate" ADD COLUMN "activities" json DEFAULT '[]'::json;--> statement-breakpoint
CREATE INDEX "vacancy_title_idx" ON "persona-management_vacancy" USING btree ("title");--> statement-breakpoint
CREATE INDEX "vacancy_status_idx" ON "persona-management_vacancy" USING btree ("status");