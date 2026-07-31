import { sql } from "drizzle-orm";
import { index, integer, pgTable, real, text, timestamp } from "drizzle-orm/pg-core";
import { episodes } from "./episodes";
import { vector } from "./vector";

export const windows = pgTable(
  "windows",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    episodeId: integer("episode_id")
      .notNull()
      .references(() => episodes.id, { onDelete: "cascade" }),
    text: text().notNull(),
    startSeconds: real("start_seconds").notNull(),
    endSeconds: real("end_seconds").notNull(),
    embedding: vector("embedding", { dimensions: 1024 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("windows_episode_id_idx").on(table.episodeId),
    index("windows_embedding_idx").using("hnsw", sql`${table.embedding} vector_cosine_ops`),
  ],
);

export type SelectWindow = typeof windows.$inferSelect;
export type InsertWindow = typeof windows.$inferInsert;
