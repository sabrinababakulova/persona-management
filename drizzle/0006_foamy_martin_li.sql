CREATE TABLE "candidate_vacancy" (
	"candidateId" varchar(255) NOT NULL,
	"vacancyId" varchar(255) NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	CONSTRAINT "candidate_vacancy_candidateId_vacancyId_pk" PRIMARY KEY("candidateId","vacancyId")
);
--> statement-breakpoint
ALTER TABLE "candidate_vacancy" ADD CONSTRAINT "candidate_vacancy_candidateId_candidate_id_fk" FOREIGN KEY ("candidateId") REFERENCES "public"."candidate"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_vacancy" ADD CONSTRAINT "candidate_vacancy_vacancyId_vacancy_id_fk" FOREIGN KEY ("vacancyId") REFERENCES "public"."vacancy"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "candidate_vacancy_candidate_id_idx" ON "candidate_vacancy" USING btree ("candidateId");--> statement-breakpoint
CREATE INDEX "candidate_vacancy_vacancy_id_idx" ON "candidate_vacancy" USING btree ("vacancyId");--> statement-breakpoint
CREATE INDEX "candidate_vacancy_created_at_idx" ON "candidate_vacancy" USING btree ("createdAt");