import { customType, index, integer, pgTable, real, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const vector = customType<{ data: number[]; driverParam: string; config: { dimensions: number } }>({
  dataType(config) {
    return `vector(${config!.dimensions})`;
  },
  toDriver(value) {
    return `[${value.join(",")}]`;
  },
  fromDriver(value) {
    return (value as string).slice(1, -1).split(",").map(Number);
  },
});

const timestamps = {
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  deletedAt: timestamp("deleted_at"),
};

export const users = pgTable("users", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  ...timestamps,
  email: varchar({ length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }),
  firstName: varchar("first_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
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
    token: varchar({ length: 500 }).notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("refresh_tokens_user_id_idx").on(table.userId)],
);

export const organizations = pgTable("organizations", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  ...timestamps,
  name: varchar({ length: 255 }).notNull(),
  description: text(),
});

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
  },
  (table) => [
    index("videos_org_active_idx")
      .on(table.organizationId)
      .where(sql`deleted_at IS NULL`),
    index("videos_youtube_video_id_idx").on(table.youtubeVideoId),
  ],
);

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
    embedding: vector("embedding", { dimensions: 1024 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("segments_video_id_idx").on(table.videoId),
    index("segments_search_idx").using(
      "gin",
      sql`to_tsvector('english', ${table.text})`,
    ),
    index("segments_embedding_idx").using(
      "hnsw",
      sql`${table.embedding} vector_cosine_ops`,
    ),
  ],
);

export type SelectUser = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export type SelectOrganization = typeof organizations.$inferSelect;
export type InsertOrganization = typeof organizations.$inferInsert;

export type SelectVideo = typeof videos.$inferSelect;
export type InsertVideo = typeof videos.$inferInsert;

export type SelectSegment = typeof segments.$inferSelect;
export type InsertSegment = typeof segments.$inferInsert;

export type SelectRefreshToken = typeof refreshTokens.$inferSelect;
export type InsertRefreshToken = typeof refreshTokens.$inferInsert;
