import { index, integer, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { timestamps } from "./shared";

export const users = pgTable("users", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  ...timestamps,
  email: varchar({ length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }),
  firstName: varchar("first_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
  emailConfirmedAt: timestamp("email_confirmed_at"),
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
    // Keep the legacy physical column name to make the security upgrade
    // non-destructive. New values are SHA-256 hashes; existing raw tokens no
    // longer match and naturally expire.
    tokenHash: varchar("token", { length: 500 }).notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("refresh_tokens_user_id_idx").on(table.userId)],
);

export const emailConfirmationTokens = pgTable("email_confirmation_tokens", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: varchar({ length: 255 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type SelectUser = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type SelectRefreshToken = typeof refreshTokens.$inferSelect;
export type InsertRefreshToken = typeof refreshTokens.$inferInsert;
export type SelectEmailConfirmationToken = typeof emailConfirmationTokens.$inferSelect;
export type InsertEmailConfirmationToken = typeof emailConfirmationTokens.$inferInsert;
