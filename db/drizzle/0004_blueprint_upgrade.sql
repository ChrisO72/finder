CREATE TABLE "email_confirmation_tokens" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "email_confirmation_tokens_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "email_confirmation_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "site_settings" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "site_settings_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"allowed_domains" text[] DEFAULT '{}' NOT NULL,
	"require_mail_confirmation" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "youtube_cookies" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_confirmed_at" timestamp;--> statement-breakpoint
ALTER TABLE "email_confirmation_tokens" ADD CONSTRAINT "email_confirmation_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;