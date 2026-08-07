CREATE TABLE "company_feature_flag" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"company_id" varchar(255) NOT NULL,
	"feature" varchar(100) NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	"updatedAt" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "company_feature_flag" ADD CONSTRAINT "company_feature_flag_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "company_feature_flag_company_feature_idx" ON "company_feature_flag" USING btree ("company_id","feature");