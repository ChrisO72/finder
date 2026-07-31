CREATE TABLE "email_confirmation_tokens" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "email_confirmation_tokens_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "email_confirmation_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "refresh_tokens_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"token" varchar(500) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "refresh_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255),
	"first_name" varchar(100),
	"last_name" varchar(100),
	"email_confirmed_at" timestamp,
	"role" varchar DEFAULT 'user' NOT NULL,
	"organization_id" integer NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "episodes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "episodes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"organization_id" integer NOT NULL,
	"feed_id" integer NOT NULL,
	"guid" text NOT NULL,
	"episode_url" text,
	"audio_url" text NOT NULL,
	"audio_mime_type" varchar(100),
	"title" text NOT NULL,
	"podcast_title" varchar(500) NOT NULL,
	"description" text,
	"artwork_url" text,
	"duration_seconds" real,
	"processed_seconds" real DEFAULT 0 NOT NULL,
	"published_at" timestamp,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"summary" text,
	"summary_embedding" vector(1024)
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "organizations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"name" varchar(255) NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "podcast_feeds" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "podcast_feeds_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"organization_id" integer NOT NULL,
	"feed_url" text NOT NULL,
	"title" varchar(500) NOT NULL,
	"description" text,
	"artwork_url" text,
	"last_synced_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "segments" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "segments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"episode_id" integer NOT NULL,
	"text" text NOT NULL,
	"start_seconds" real NOT NULL,
	"end_seconds" real NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_settings" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "site_settings_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"key" varchar(32) DEFAULT 'global' NOT NULL,
	"allowed_domains" text[] DEFAULT '{}' NOT NULL,
	"require_mail_confirmation" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "site_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "episode_tags" (
	"episode_id" integer NOT NULL,
	"tag_id" integer NOT NULL,
	CONSTRAINT "episode_tags_episode_id_tag_id_pk" PRIMARY KEY("episode_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tags_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"organization_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "windows" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "windows_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"episode_id" integer NOT NULL,
	"text" text NOT NULL,
	"start_seconds" real NOT NULL,
	"end_seconds" real NOT NULL,
	"embedding" vector(1024),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_confirmation_tokens" ADD CONSTRAINT "email_confirmation_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_feed_id_podcast_feeds_id_fk" FOREIGN KEY ("feed_id") REFERENCES "public"."podcast_feeds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "podcast_feeds" ADD CONSTRAINT "podcast_feeds_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "segments" ADD CONSTRAINT "segments_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episode_tags" ADD CONSTRAINT "episode_tags_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episode_tags" ADD CONSTRAINT "episode_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "windows" ADD CONSTRAINT "windows_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "episodes_feed_guid_idx" ON "episodes" USING btree ("feed_id","guid");--> statement-breakpoint
CREATE INDEX "episodes_org_active_idx" ON "episodes" USING btree ("organization_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "episodes_published_at_idx" ON "episodes" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "episodes_summary_search_idx" ON "episodes" USING gin (to_tsvector('english', "summary"));--> statement-breakpoint
CREATE INDEX "episodes_summary_embedding_idx" ON "episodes" USING hnsw ("summary_embedding" vector_cosine_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "podcast_feeds_org_url_idx" ON "podcast_feeds" USING btree ("organization_id","feed_url");--> statement-breakpoint
CREATE INDEX "podcast_feeds_org_idx" ON "podcast_feeds" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "segments_episode_id_idx" ON "segments" USING btree ("episode_id");--> statement-breakpoint
CREATE INDEX "segments_search_idx" ON "segments" USING gin (to_tsvector('english', "text"));--> statement-breakpoint
CREATE INDEX "episode_tags_tag_id_idx" ON "episode_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_slug_org_idx" ON "tags" USING btree ("slug","organization_id");--> statement-breakpoint
CREATE INDEX "windows_episode_id_idx" ON "windows" USING btree ("episode_id");--> statement-breakpoint
CREATE INDEX "windows_embedding_idx" ON "windows" USING hnsw ("embedding" vector_cosine_ops);