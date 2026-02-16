CREATE TABLE IF NOT EXISTS "persona-management_recent_activity_log" (
  "id" varchar(255) PRIMARY KEY NOT NULL,
  "entityType" varchar(50) NOT NULL,
  "entityId" varchar(255) NOT NULL,
  "actorUserId" varchar(255),
  "actorName" varchar(255) NOT NULL,
  "action" varchar(255) NOT NULL,
  "targetName" varchar(255) NOT NULL,
  "targetStatus" varchar(255) NOT NULL,
  "createdAt" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  ALTER TABLE "persona-management_recent_activity_log"
  ADD CONSTRAINT "persona-management_recent_activity_log_actorUserId_persona-management_user_id_fk"
  FOREIGN KEY ("actorUserId")
  REFERENCES "persona-management_user"("id")
  ON DELETE NO ACTION
  ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "recent_activity_created_at_idx"
  ON "persona-management_recent_activity_log" USING btree ("createdAt");

CREATE INDEX IF NOT EXISTS "recent_activity_entity_idx"
  ON "persona-management_recent_activity_log" USING btree ("entityType", "entityId");
