DROP INDEX "vacancy_hh_vacancy_id_idx";--> statement-breakpoint
CREATE INDEX "vacancy_hh_vacancy_id_idx" ON "vacancy" USING btree ("hh_vacancy_id");