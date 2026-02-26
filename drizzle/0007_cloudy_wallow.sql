CREATE TABLE "persona-management_vacancy_level_option" (
	"value" varchar(50) PRIMARY KEY NOT NULL,
	"label" varchar(255) NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "persona-management_vacancy_status_option" (
	"value" varchar(50) PRIMARY KEY NOT NULL,
	"label" varchar(255) NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "persona-management_vacancy_work_type_option" (
	"value" varchar(50) PRIMARY KEY NOT NULL,
	"label" varchar(255) NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
INSERT INTO "persona-management_vacancy_level_option" ("value", "label", "sortOrder", "isActive")
VALUES
	('intern', 'Стажер', 10, true),
	('junior', 'Джуниор', 20, true),
	('middle', 'Мидл', 30, true),
	('senior', 'Сеньор', 40, true),
	('lead', 'Лид', 50, true)
ON CONFLICT ("value") DO UPDATE
SET
	"label" = EXCLUDED."label",
	"sortOrder" = EXCLUDED."sortOrder",
	"isActive" = EXCLUDED."isActive";
--> statement-breakpoint
INSERT INTO "persona-management_vacancy_work_type_option" ("value", "label", "sortOrder", "isActive")
VALUES
	('office', 'Офис', 10, true),
	('remote', 'Удаленно', 20, true),
	('hybrid', 'Гибрид', 30, true),
	('part-time', 'Частичная занятость', 40, true)
ON CONFLICT ("value") DO UPDATE
SET
	"label" = EXCLUDED."label",
	"sortOrder" = EXCLUDED."sortOrder",
	"isActive" = EXCLUDED."isActive";
--> statement-breakpoint
INSERT INTO "persona-management_vacancy_status_option" ("value", "label", "sortOrder", "isActive")
VALUES
	('active', 'Активна', 10, true),
	('draft', 'Черновик', 20, true),
	('paused', 'Приостановлена', 30, true),
	('closed', 'Закрыта', 40, true),
	('archive', 'Архив', 50, true)
ON CONFLICT ("value") DO UPDATE
SET
	"label" = EXCLUDED."label",
	"sortOrder" = EXCLUDED."sortOrder",
	"isActive" = EXCLUDED."isActive";
