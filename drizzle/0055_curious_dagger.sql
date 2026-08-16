ALTER TABLE "vacancy_candidate" ADD COLUMN "match_analysis_translations" json;--> statement-breakpoint
ALTER TABLE "vacancy_candidate" ADD COLUMN "matched_skills_translations" json;--> statement-breakpoint
ALTER TABLE "vacancy_candidate" ADD COLUMN "missing_skills_translations" json;--> statement-breakpoint
ALTER TABLE "candidate" ADD COLUMN "ai_analysis_translations" json;--> statement-breakpoint
ALTER TABLE "telegram_resume_import" ADD COLUMN "ai_analysis_translations" json;