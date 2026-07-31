import { index, integer, pgTable, primaryKey, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { episodes } from "./episodes";
import { organizations } from "./organizations";
import { timestamps } from "./shared";

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

export const episodeTags = pgTable(
  "episode_tags",
  {
    episodeId: integer("episode_id")
      .notNull()
      .references(() => episodes.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.episodeId, table.tagId] }),
    index("episode_tags_tag_id_idx").on(table.tagId),
  ],
);

export type SelectTag = typeof tags.$inferSelect;
export type InsertTag = typeof tags.$inferInsert;
export type SelectEpisodeTag = typeof episodeTags.$inferSelect;
export type InsertEpisodeTag = typeof episodeTags.$inferInsert;
