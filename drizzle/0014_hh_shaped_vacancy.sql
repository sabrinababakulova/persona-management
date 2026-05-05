ALTER TABLE "vacancy" DROP COLUMN "level";--> statement-breakpoint
ALTER TABLE "vacancy" DROP COLUMN "city";--> statement-breakpoint
ALTER TABLE "vacancy" DROP COLUMN "workType";--> statement-breakpoint
ALTER TABLE "vacancy" DROP COLUMN "salaryExpectation";--> statement-breakpoint
ALTER TABLE "vacancy" DROP COLUMN "workScheduleStart";--> statement-breakpoint
ALTER TABLE "vacancy" DROP COLUMN "workScheduleEnd";--> statement-breakpoint
ALTER TABLE "vacancy" DROP COLUMN "comments";--> statement-breakpoint
ALTER TABLE "vacancy" DROP COLUMN "tasks";--> statement-breakpoint
ALTER TABLE "vacancy" DROP COLUMN "team";--> statement-breakpoint
ALTER TABLE "vacancy" DROP COLUMN "companyDescription";--> statement-breakpoint
ALTER TABLE "vacancy" ADD COLUMN "area_id" varchar(20);--> statement-breakpoint
ALTER TABLE "vacancy" ADD COLUMN "employment_id" varchar(50);--> statement-breakpoint
ALTER TABLE "vacancy" ADD COLUMN "schedule_id" varchar(50);--> statement-breakpoint
ALTER TABLE "vacancy" ADD COLUMN "experience_id" varchar(50);--> statement-breakpoint
ALTER TABLE "vacancy" ADD COLUMN "professional_role_id" varchar(50);--> statement-breakpoint
ALTER TABLE "vacancy" ADD COLUMN "billing_type_id" varchar(50);--> statement-breakpoint
ALTER TABLE "vacancy" ADD COLUMN "salary_from" integer;--> statement-breakpoint
ALTER TABLE "vacancy" ADD COLUMN "salary_to" integer;--> statement-breakpoint
ALTER TABLE "vacancy" ADD COLUMN "description_html" text;--> statement-breakpoint
ALTER TABLE "vacancy" ADD COLUMN "contact_phone" varchar(50);
