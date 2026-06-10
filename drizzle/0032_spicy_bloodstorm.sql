CREATE TABLE "user_telegram_bot_setting" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"userId" varchar(255) NOT NULL,
	"bot_token" varchar(255) NOT NULL,
	"bot_username" varchar(255),
	"createdAt" timestamp with time zone NOT NULL,
	"updatedAt" timestamp with time zone,
	CONSTRAINT "user_telegram_bot_setting_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
ALTER TABLE "user_telegram_bot_setting" ADD CONSTRAINT "user_telegram_bot_setting_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;