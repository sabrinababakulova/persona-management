-- Per-application funnel stages, and one application row per (vacancy, candidate).
--
-- `vacancy_candidate.stage` has existed since the sync engine was added, documented as the
-- recruiter-owned funnel stage, but nothing ever read it: the funnel bucketed on the
-- candidate-level `candidate.status` and wrote back to it, so moving someone in one vacancy's
-- funnel moved them in every other vacancy's too. Backfill each application's stage from the
-- candidate's current status first, so the funnel renders exactly as it did before the read
-- path switches over.
UPDATE "vacancy_candidate" AS "application"
SET "stage" = COALESCE("candidate"."status", 'new')
FROM "candidate"
WHERE "application"."candidate_id" = "candidate"."id"
  AND "application"."stage" IS DISTINCT FROM COALESCE("candidate"."status", 'new');
--> statement-breakpoint
-- Manual links had no uniqueness constraint, so the check-then-insert in `assignCandidate`
-- could race into duplicate rows. Collapse any that exist onto the earliest row before the
-- unique index goes on, keeping whichever row carries an hh.uz negotiation id.
DELETE FROM "vacancy_candidate" AS "duplicate"
USING "vacancy_candidate" AS "keeper"
WHERE "duplicate"."vacancy_id" = "keeper"."vacancy_id"
  AND "duplicate"."candidate_id" = "keeper"."candidate_id"
  AND (
    ("keeper"."hh_negotiation_id" IS NOT NULL AND "duplicate"."hh_negotiation_id" IS NULL)
    OR (
      ("keeper"."hh_negotiation_id" IS NULL) = ("duplicate"."hh_negotiation_id" IS NULL)
      AND "keeper"."id" < "duplicate"."id"
    )
  );
--> statement-breakpoint
CREATE UNIQUE INDEX "vacancy_candidate_vacancy_candidate_idx" ON "vacancy_candidate" USING btree ("vacancy_id","candidate_id");
