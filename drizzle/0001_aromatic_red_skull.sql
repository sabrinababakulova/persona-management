CREATE TABLE "persona-management_candidate_contact_type" (
	"value" varchar(50) PRIMARY KEY NOT NULL,
	"label" varchar(255) NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "persona-management_candidate_language_level" (
	"value" varchar(10) PRIMARY KEY NOT NULL,
	"label" varchar(255) NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "persona-management_candidate_language" (
	"value" varchar(50) PRIMARY KEY NOT NULL,
	"label" varchar(255) NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "persona-management_candidate_position" (
	"value" varchar(100) PRIMARY KEY NOT NULL,
	"label" varchar(255) NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "persona-management_candidate_skill" (
	"value" varchar(255) PRIMARY KEY NOT NULL,
	"label" varchar(255) NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "persona-management_candidate_source" (
	"value" varchar(100) PRIMARY KEY NOT NULL,
	"label" varchar(255) NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "persona-management_candidate_status_option" (
	"value" varchar(50) PRIMARY KEY NOT NULL,
	"label" varchar(255) NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
INSERT INTO "persona-management_candidate_contact_type" ("value", "label", "sortOrder", "isActive") VALUES
	('telegram', 'Telegram', 1, true),
	('phone', 'Телефон', 2, true),
	('email', 'Email', 3, true),
	('whatsapp', 'WhatsApp', 4, true);
--> statement-breakpoint
INSERT INTO "persona-management_candidate_source" ("value", "label", "sortOrder", "isActive") VALUES
	('hh.uz', 'hh.uz', 1, true),
	('linkedin', 'LinkedIn', 2, true),
	('telegram', 'Telegram', 3, true),
	('referral', 'Реферал', 4, true),
	('other', 'Другое', 5, true);
--> statement-breakpoint
INSERT INTO "persona-management_candidate_position" ("value", "label", "sortOrder", "isActive") VALUES
	('frontend_developer', 'Frontend Developer', 1, true),
	('backend_developer', 'Backend Developer', 2, true),
	('fullstack_developer', 'Fullstack Developer', 3, true),
	('product_designer', 'Product Designer', 4, true),
	('graphic_designer', 'Graphic Designer', 5, true),
	('project_manager', 'Project Manager', 6, true),
	('hr_manager', 'HR Manager', 7, true),
	('marketing_manager', 'Marketing Manager', 8, true);
--> statement-breakpoint
INSERT INTO "persona-management_candidate_skill" ("value", "label", "sortOrder", "isActive") VALUES
	('React', 'React', 1, true),
	('TypeScript', 'TypeScript', 2, true),
	('JavaScript', 'JavaScript', 3, true),
	('Node.js', 'Node.js', 4, true),
	('Python', 'Python', 5, true),
	('Figma', 'Figma', 6, true),
	('Adobe Photoshop', 'Adobe Photoshop', 7, true),
	('Adobe Illustrator', 'Adobe Illustrator', 8, true),
	('Коммуникабельность', 'Коммуникабельность', 9, true),
	('Креативность', 'Креативность', 10, true),
	('Управление проектами', 'Управление проектами', 11, true),
	('Аналитика', 'Аналитика', 12, true);
--> statement-breakpoint
INSERT INTO "persona-management_candidate_language" ("value", "label", "sortOrder", "isActive") VALUES
	('russian', 'Русский', 1, true),
	('uzbek', 'Узбекский', 2, true),
	('english', 'Английский', 3, true),
	('german', 'Немецкий', 4, true),
	('french', 'Французский', 5, true),
	('spanish', 'Испанский', 6, true),
	('korean', 'Корейский', 7, true),
	('chinese', 'Китайский', 8, true);
--> statement-breakpoint
INSERT INTO "persona-management_candidate_language_level" ("value", "label", "sortOrder", "isActive") VALUES
	('A1', 'A1 - Начальный', 1, true),
	('A2', 'A2 - Элементарный', 2, true),
	('B1', 'B1 - Средний', 3, true),
	('B2', 'B2 - Выше среднего', 4, true),
	('C1', 'C1 - Продвинутый', 5, true),
	('C2', 'C2 - Владение в совершенстве', 6, true);
--> statement-breakpoint
INSERT INTO "persona-management_candidate_status_option" ("value", "label", "sortOrder", "isActive") VALUES
	('new', 'Новый', 1, true),
	('screening', 'Скрининг', 2, true),
	('interview', 'Интервью', 3, true),
	('offer', 'Оффер', 4, true),
	('hired', 'Нанят', 5, true),
	('rejected', 'Отклонен', 6, true);
