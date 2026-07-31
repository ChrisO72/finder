import { index, integer, pgTable, primaryKey, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { timestamps } from "./shared";
import { videos } from "./videos";

export const tags = pgTable(
  "tags",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    ...timestamps,
    name: varchar({ length: 100 }).notNull(),
    slug: varchar({ length: 100 }).notNull(),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
  },
  (table) => [uniqueIndex("tags_slug_org_idx").on(table.slug, table.organizationId)],
);

export const videoTags = pgTable(
  "video_tags",
  {
    videoId: integer("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.videoId, table.tagId] }),
    index("video_tags_tag_id_idx").on(table.tagId),
  ],
);

export type SelectTag = typeof tags.$inferSelect;
export type InsertTag = typeof tags.$inferInsert;
export type SelectVideoTag = typeof videoTags.$inferSelect;
export type InsertVideoTag = typeof videoTags.$inferInsert;
