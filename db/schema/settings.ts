import { boolean, integer, pgTable, text, varchar } from "drizzle-orm/pg-core";
import { timestamps } from "./shared";

export const siteSettings = pgTable("site_settings", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  key: varchar({ length: 32 }).notNull().default("global").unique(),
  allowedDomains: text("allowed_domains").array().notNull().default([]),
  requireMailConfirmation: boolean("require_mail_confirmation").notNull().default(false),
  ...timestamps,
});

export type SelectSiteSettings = typeof siteSettings.$inferSelect;
export type InsertSiteSettings = typeof siteSettings.$inferInsert;
