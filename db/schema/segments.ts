import { sql } from "drizzle-orm";
import { index, integer, pgTable, real, text, timestamp } from "drizzle-orm/pg-core";
import { episodes } from "./episodes";

export const segments = pgTable(
  "segments",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    episodeId: integer("episode_id")
      .notNull()
      .references(() => episodes.id, { onDelete: "cascade" }),
    text: text().notNull(),
    startSeconds: real("start_seconds").notNull(),
    endSeconds: real("end_seconds").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("segments_episode_id_idx").on(table.episodeId),
    index("segments_search_idx").using("gin", sql`to_tsvector('english', ${table.text})`),
  ],
);

export type SelectSegment = typeof segments.$inferSelect;
export type InsertSegment = typeof segments.$inferInsert;
