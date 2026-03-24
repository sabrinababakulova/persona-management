ALTER TABLE "candidate" ADD COLUMN "companyId" varchar(255);--> statement-breakpoint
ALTER TABLE "candidate" ADD CONSTRAINT "candidate_companyId_company_id_fk" FOREIGN KEY ("companyId") REFERENCES "public"."company"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "candidate_company_id_idx" ON "candidate" USING btree ("companyId");