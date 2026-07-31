ALTER TABLE "site_settings" ADD COLUMN "key" varchar(32) DEFAULT 'global' NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_key_unique" UNIQUE("key");