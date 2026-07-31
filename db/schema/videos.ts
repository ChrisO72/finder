import { sql } from "drizzle-orm";
import { index, integer, pgTable, real, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { timestamps } from "./shared";
import { vector } from "./vector";

export const videos = pgTable(
  "videos",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    ...timestamps,
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    youtubeUrl: text("youtube_url").notNull(),
    youtubeVideoId: varchar("youtube_video_id", { length: 20 }).notNull(),
    title: text(),
    channelTitle: varchar("channel_title", { length: 255 }),
    thumbnailUrl: text("thumbnail_url"),
    durationSeconds: real("duration_seconds"),
    processedSeconds: real("processed_seconds").notNull().default(0),
    publishedAt: timestamp("published_at"),
    status: varchar({ enum: ["pending", "processing", "ready", "failed"] })
      .notNull()
      .default("pending"),
    errorMessage: text("error_message"),
    summary: text(),
    summaryEmbedding: vector("summary_embedding", { dimensions: 1024 }),
  },
  (table) => [
    index("videos_org_active_idx")
      .on(table.organizationId)
      .where(sql`deleted_at IS NULL`),
    index("videos_youtube_video_id_idx").on(table.youtubeVideoId),
    index("videos_summary_search_idx").using("gin", sql`to_tsvector('english', ${table.summary})`),
    index("videos_summary_embedding_idx").using(
      "hnsw",
      sql`${table.summaryEmbedding} vector_cosine_ops`,
    ),
  ],
);

export type SelectVideo = typeof videos.$inferSelect;
export type InsertVideo = typeof videos.$inferInsert;
