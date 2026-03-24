ALTER TABLE "company" ADD COLUMN "city" varchar(255);--> statement-breakpoint
ALTER TABLE "company" ADD COLUMN "country" varchar(255) DEFAULT 'Узбекистан';--> statement-breakpoint
ALTER TABLE "company" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "company" ADD COLUMN "website" varchar(500);--> statement-breakpoint
ALTER TABLE "company" ADD COLUMN "phone" varchar(50);--> statement-breakpoint
ALTER TABLE "company" ADD COLUMN "logoUrl" varchar(500);