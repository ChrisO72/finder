import { sql } from "drizzle-orm";
import { index, integer, pgTable, real, text, timestamp } from "drizzle-orm/pg-core";
import { vector } from "./vector";
import { videos } from "./videos";

export const windows = pgTable(
  "windows",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    videoId: integer("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    text: text().notNull(),
    startSeconds: real("start_seconds").notNull(),
    endSeconds: real("end_seconds").notNull(),
    embedding: vector("embedding", { dimensions: 1024 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("windows_video_id_idx").on(table.videoId),
    index("windows_embedding_idx").using("hnsw", sql`${table.embedding} vector_cosine_ops`),
  ],
);

export type SelectWindow = typeof windows.$inferSelect;
export type InsertWindow = typeof windows.$inferInsert;
