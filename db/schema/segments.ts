import { sql } from "drizzle-orm";
import { index, integer, pgTable, real, text, timestamp } from "drizzle-orm/pg-core";
import { videos } from "./videos";

export const segments = pgTable(
  "segments",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    videoId: integer("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    text: text().notNull(),
    startSeconds: real("start_seconds").notNull(),
    endSeconds: real("end_seconds").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("segments_video_id_idx").on(table.videoId),
    index("segments_search_idx").using("gin", sql`to_tsvector('english', ${table.text})`),
  ],
);

export type SelectSegment = typeof segments.$inferSelect;
export type InsertSegment = typeof segments.$inferInsert;
