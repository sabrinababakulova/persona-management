CREATE TABLE IF NOT EXISTS "vacancy_source_option" (
	"value" varchar(100) PRIMARY KEY NOT NULL,
	"label" varchar(255) NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
INSERT INTO "vacancy_source_option" ("value", "label", "sortOrder", "isActive")
VALUES
	('local', 'Локальная', 0, true),
	('hh.uz', 'hh.uz', 1, true)
ON CONFLICT ("value") DO UPDATE SET
	"label" = EXCLUDED."label",
	"sortOrder" = EXCLUDED."sortOrder",
	"isActive" = EXCLUDED."isActive";
