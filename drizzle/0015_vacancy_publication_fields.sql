ALTER TABLE "vacancy" ADD COLUMN "is_publication" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "vacancy" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "vacancy" ADD COLUMN "destination" varchar(50);
