import { index, integer, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const timestamps = {
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  deletedAt: timestamp("deleted_at"),
};

export const users = pgTable("users", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  ...timestamps,
  email: varchar({ length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }),
  firstName: varchar("first_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
  role: varchar({ enum: ["admin", "user", "viewer"] })
    .notNull()
    .default("user"),
  organizationId: integer("organization_id")
    .notNull()
    .references(() => organizations.id, {
      onDelete: "cascade",
    }),
});

export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: varchar({ length: 500 }).notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("refresh_tokens_user_id_idx").on(table.userId)],
);

export const organizations = pgTable("organizations", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  ...timestamps,
  name: varchar({ length: 255 }).notNull(),
  description: text(),
});

export const items = pgTable(
  "items",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    ...timestamps,
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    title: varchar({ length: 255 }).notNull(),
    description: text(),
    status: varchar({ enum: ["draft", "published", "archived"] })
      .notNull()
      .default("draft"),
    priority: integer().default(0),
  },
  // Partial indexes: only index non-deleted rows to optimize soft-delete queries
  (table) => [
    index("items_active_idx")
      .on(table.id)
      .where(sql`deleted_at IS NULL`),
    index("items_org_active_idx")
      .on(table.organizationId)
      .where(sql`deleted_at IS NULL`),
  ],
);

export const subItems = pgTable(
  "sub_items",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    ...timestamps,
    itemId: integer("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    title: varchar({ length: 255 }).notNull(),
    description: text(),
  },
  // Partial indexes: only index non-deleted rows to optimize soft-delete queries
  (table) => [
    index("sub_items_active_idx")
      .on(table.id)
      .where(sql`deleted_at IS NULL`),
    index("sub_items_item_active_idx")
      .on(table.itemId)
      .where(sql`deleted_at IS NULL`),
  ],
);

export type SelectUser = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export type SelectOrganization = typeof organizations.$inferSelect;
export type InsertOrganization = typeof organizations.$inferInsert;

export type SelectItem = typeof items.$inferSelect;
export type InsertItem = typeof items.$inferInsert;

export type SelectSubItem = typeof subItems.$inferSelect;
export type InsertSubItem = typeof subItems.$inferInsert;

export type SelectRefreshToken = typeof refreshTokens.$inferSelect;
export type InsertRefreshToken = typeof refreshTokens.$inferInsert;
