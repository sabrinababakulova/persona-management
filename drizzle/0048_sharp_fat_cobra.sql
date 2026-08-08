CREATE TABLE "candidate_meeting" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"candidate_id" varchar(255) NOT NULL,
	"company_id" varchar(255) NOT NULL,
	"organizer_user_id" varchar(255),
	"organizer_name" varchar(255) NOT NULL,
	"organizer_email" varchar(255) NOT NULL,
	"candidate_email" varchar(255) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"location" varchar(500),
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"time_zone" varchar(100) DEFAULT 'Asia/Tashkent' NOT NULL,
	"invitation_uid" varchar(255) NOT NULL,
	"invitation_status" varchar(20) DEFAULT 'pending' NOT NULL,
	"invitation_sent_at" timestamp with time zone,
	"invitation_error" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "candidate_meeting" ADD CONSTRAINT "candidate_meeting_candidate_id_candidate_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidate"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_meeting" ADD CONSTRAINT "candidate_meeting_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_meeting" ADD CONSTRAINT "candidate_meeting_organizer_user_id_user_id_fk" FOREIGN KEY ("organizer_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "candidate_meeting_invitation_uid_idx" ON "candidate_meeting" USING btree ("invitation_uid");--> statement-breakpoint
CREATE INDEX "candidate_meeting_candidate_start_idx" ON "candidate_meeting" USING btree ("candidate_id","start_at");--> statement-breakpoint
CREATE INDEX "candidate_meeting_company_start_idx" ON "candidate_meeting" USING btree ("company_id","start_at");