ALTER TABLE "items" DROP CONSTRAINT "items_user_id_users_id_fk";
--> statement-breakpoint
DROP INDEX "items_user_active_idx";--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "organization_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "items_org_active_idx" ON "items" USING btree ("organization_id") WHERE deleted_at IS NULL;--> statement-breakpoint
ALTER TABLE "items" DROP COLUMN "user_id";