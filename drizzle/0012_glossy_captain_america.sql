ALTER TABLE "persona-management_vacancy" ADD COLUMN "workScheduleStart" varchar(10) DEFAULT '09:00';--> statement-breakpoint
ALTER TABLE "persona-management_vacancy" ADD COLUMN "workScheduleEnd" varchar(10) DEFAULT '18:00';--> statement-breakpoint
ALTER TABLE "persona-management_vacancy" ADD COLUMN "comments" text;