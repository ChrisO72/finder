ALTER TABLE "items" RENAME COLUMN "userId" TO "user_id";--> statement-breakpoint
ALTER TABLE "sub_items" RENAME COLUMN "itemId" TO "item_id";--> statement-breakpoint
ALTER TABLE "users" RENAME COLUMN "firstName" TO "first_name";--> statement-breakpoint
ALTER TABLE "users" RENAME COLUMN "lastName" TO "last_name";--> statement-breakpoint
ALTER TABLE "users" RENAME COLUMN "organizationId" TO "organization_id";--> statement-breakpoint
ALTER TABLE "items" DROP CONSTRAINT "items_userId_users_id_fk";
--> statement-breakpoint
ALTER TABLE "sub_items" DROP CONSTRAINT "sub_items_itemId_items_id_fk";
--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_organizationId_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sub_items" ADD CONSTRAINT "sub_items_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "items_active_idx" ON "items" USING btree ("id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "items_user_active_idx" ON "items" USING btree ("user_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "sub_items_active_idx" ON "sub_items" USING btree ("id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "sub_items_item_active_idx" ON "sub_items" USING btree ("item_id") WHERE deleted_at IS NULL;