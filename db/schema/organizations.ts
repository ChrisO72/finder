import { integer, pgTable, text, varchar } from "drizzle-orm/pg-core";
import { timestamps } from "./shared";

export const organizations = pgTable("organizations", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  ...timestamps,
  name: varchar({ length: 255 }).notNull(),
  description: text(),
});

export type SelectOrganization = typeof organizations.$inferSelect;
export type InsertOrganization = typeof organizations.$inferInsert;
