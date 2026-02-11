ALTER TABLE "persona-management_user"
ADD COLUMN IF NOT EXISTS "hasSeenWelcomeModal" boolean NOT NULL DEFAULT true;

DO $$
BEGIN
  ALTER TABLE "persona-management_user"
  ADD CONSTRAINT "persona-management_user_email_unique" UNIQUE ("email");
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
