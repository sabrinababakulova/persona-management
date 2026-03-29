ALTER TABLE "candidate" ADD COLUMN "resumeFileId" varchar(255);--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "avatarFileId" varchar(255);--> statement-breakpoint
ALTER TABLE "candidate" DROP COLUMN "resumeUrl";