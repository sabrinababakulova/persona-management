-- Convert candidate.experience from a localized text label (e.g. "2 года 1 мес.", "5+ лет")
-- to an integer number of months. Existing values are parsed in place so no data is lost;
-- the app formats the integer back to a localized string at display time.
ALTER TABLE "candidate" ADD COLUMN "experience_months" integer;

UPDATE "candidate"
SET "experience_months" = NULLIF(
  COALESCE(NULLIF(substring("experience" from '(\d+)\s*\+?\s*(?:лет|года|год)'), '')::int, 0) * 12
  + COALESCE(NULLIF(substring("experience" from '(\d+)\s*мес'), '')::int, 0),
  0
)
WHERE "experience" IS NOT NULL AND btrim("experience") <> '';

ALTER TABLE "candidate" DROP COLUMN "experience";
ALTER TABLE "candidate" RENAME COLUMN "experience_months" TO "experience";
