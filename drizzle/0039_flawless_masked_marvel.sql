CREATE TABLE "company_invitation" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"companyId" varchar(255) NOT NULL,
	"token" varchar(64) NOT NULL,
	"createdById" varchar(255),
	"expiresAt" timestamp with time zone NOT NULL,
	"revokedAt" timestamp with time zone,
	"usesCount" integer DEFAULT 0 NOT NULL,
	"lastUsedAt" timestamp with time zone,
	"createdAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "company" ADD COLUMN "logoFileId" varchar(255);--> statement-breakpoint
ALTER TABLE "company_invitation" ADD CONSTRAINT "company_invitation_companyId_company_id_fk" FOREIGN KEY ("companyId") REFERENCES "public"."company"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_invitation" ADD CONSTRAINT "company_invitation_createdById_user_id_fk" FOREIGN KEY ("createdById") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "company_invitation_token_idx" ON "company_invitation" USING btree ("token");--> statement-breakpoint
CREATE INDEX "company_invitation_company_id_idx" ON "company_invitation" USING btree ("companyId");