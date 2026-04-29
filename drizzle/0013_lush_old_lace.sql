ALTER TABLE "vacancy" ADD COLUMN "hh_vacancy_id" varchar(100);--> statement-breakpoint
CREATE UNIQUE INDEX "vacancy_hh_vacancy_id_idx" ON "vacancy" USING btree ("hh_vacancy_id");