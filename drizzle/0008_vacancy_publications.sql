CREATE TABLE "vacancy_publication" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"vacancy_id" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"sources" json DEFAULT '[]'::json NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	"updatedAt" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "vacancy_publication" ADD CONSTRAINT "vacancy_publication_vacancy_id_vacancy_id_fk" FOREIGN KEY ("vacancy_id") REFERENCES "public"."vacancy"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "vacancy_publication_vacancy_id_idx" ON "vacancy_publication" USING btree ("vacancy_id");
--> statement-breakpoint
CREATE INDEX "vacancy_publication_active_idx" ON "vacancy_publication" USING btree ("isActive");
--> statement-breakpoint
CREATE INDEX "vacancy_publication_created_at_idx" ON "vacancy_publication" USING btree ("createdAt");
