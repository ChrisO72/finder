import { sql } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { podcastFeeds } from "./podcastFeeds";
import { timestamps } from "./shared";
import { vector } from "./vector";

export const episodes = pgTable(
  "episodes",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    ...timestamps,
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    feedId: integer("feed_id")
      .notNull()
      .references(() => podcastFeeds.id, { onDelete: "cascade" }),
    guid: text().notNull(),
    episodeUrl: text("episode_url"),
    audioUrl: text("audio_url").notNull(),
    audioMimeType: varchar("audio_mime_type", { length: 100 }),
    title: text().notNull(),
    podcastTitle: varchar("podcast_title", { length: 500 }).notNull(),
    description: text(),
    artworkUrl: text("artwork_url"),
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
    uniqueIndex("episodes_feed_guid_idx").on(table.feedId, table.guid),
    index("episodes_org_active_idx")
      .on(table.organizationId)
      .where(sql`deleted_at IS NULL`),
    index("episodes_published_at_idx").on(table.publishedAt),
    index("episodes_summary_search_idx").using(
      "gin",
      sql`to_tsvector('english', ${table.summary})`,
    ),
    index("episodes_summary_embedding_idx").using(
      "hnsw",
      sql`${table.summaryEmbedding} vector_cosine_ops`,
    ),
  ],
);

export type SelectEpisode = typeof episodes.$inferSelect;
export type InsertEpisode = typeof episodes.$inferInsert;
