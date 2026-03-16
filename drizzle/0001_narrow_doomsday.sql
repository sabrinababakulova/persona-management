CREATE TABLE "monitor_event_bucket" (
	"eventType" varchar(64) NOT NULL,
	"bucketStart" timestamp with time zone NOT NULL,
	"target" varchar(255) DEFAULT 'all' NOT NULL,
	"outcome" varchar(64) DEFAULT 'count' NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"lastSeenAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "monitor_event_bucket_eventType_bucketStart_target_outcome_pk" PRIMARY KEY("eventType","bucketStart","target","outcome")
);
--> statement-breakpoint
CREATE INDEX "monitor_event_bucket_type_bucket_idx" ON "monitor_event_bucket" USING btree ("eventType","bucketStart");--> statement-breakpoint
CREATE INDEX "monitor_event_bucket_target_idx" ON "monitor_event_bucket" USING btree ("target","bucketStart");