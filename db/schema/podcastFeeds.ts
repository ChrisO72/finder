import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { timestamps } from "./shared";

export const podcastFeeds = pgTable(
  "podcast_feeds",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    ...timestamps,
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    feedUrl: text("feed_url").notNull(),
    title: varchar({ length: 500 }).notNull(),
    description: text(),
    artworkUrl: text("artwork_url"),
    lastSyncedAt: timestamp("last_synced_at"),
  },
  (table) => [
    uniqueIndex("podcast_feeds_org_url_idx").on(table.organizationId, table.feedUrl),
    index("podcast_feeds_org_idx").on(table.organizationId),
  ],
);

export type SelectPodcastFeed = typeof podcastFeeds.$inferSelect;
export type InsertPodcastFeed = typeof podcastFeeds.$inferInsert;
