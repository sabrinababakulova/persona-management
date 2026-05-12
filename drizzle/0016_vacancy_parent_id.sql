ALTER TABLE "vacancy" ADD COLUMN "parentId" varchar(255);--> statement-breakpoint
UPDATE "vacancy" SET "parentId" = "id" WHERE "parentId" IS NULL;--> statement-breakpoint
ALTER TABLE "vacancy" ALTER COLUMN "parentId" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "vacancy_parent_id_idx" ON "vacancy" USING btree ("parentId");
