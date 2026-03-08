import { eq, sql } from "drizzle-orm";
import { Mistral } from "@mistralai/mistralai";
import { db } from "../db";
import { type InsertSegment, segments, windows, videos, videoTags, tags } from "../schema";

const mistral = new Mistral({ apiKey: process.env.MISTRAL_API_KEY! });

export async function bulkInsertSegments(rows: InsertSegment[]) {
  if (rows.length === 0) return [];
  return await db.insert(segments).values(rows).returning();
}

export async function getSegmentsByVideoId(videoId: number) {
  return await db
    .select()
    .from(segments)
    .where(eq(segments.videoId, videoId))
    .orderBy(segments.startSeconds);
}

export type SearchResult = {
  segmentId: number;
  videoId: number;
  text: string;
  headline: string;
  startSeconds: number;
  endSeconds: number;
  rank: number;
  videoTitle: string | null;
  youtubeVideoId: string;
  thumbnailUrl: string | null;
  channelTitle: string | null;
};

export async function searchSegments(
  query: string,
  organizationId: number,
  limit: number = 20,
  tagSlug?: string,
): Promise<SearchResult[]> {
  const tsquery = sql`plainto_tsquery('english', ${query})`;

  const tagJoin = tagSlug
    ? sql`INNER JOIN ${videoTags} ON ${videoTags.videoId} = ${videos.id}
           INNER JOIN ${tags} ON ${videoTags.tagId} = ${tags.id} AND ${tags.slug} = ${tagSlug}`
    : sql``;

  const rows = await db.execute<SearchResult>(sql`
    SELECT
      ${segments.id} AS "segmentId",
      ${segments.videoId} AS "videoId",
      ${segments.text} AS "text",
      ts_headline('english', ${segments.text}, ${tsquery},
        'StartSel=<mark>, StopSel=</mark>, MaxFragments=2, MaxWords=30, MinWords=15'
      ) AS "headline",
      ${segments.startSeconds} AS "startSeconds",
      ${segments.endSeconds} AS "endSeconds",
      ts_rank(to_tsvector('english', ${segments.text}), ${tsquery}) AS "rank",
      ${videos.title} AS "videoTitle",
      ${videos.youtubeVideoId} AS "youtubeVideoId",
      ${videos.thumbnailUrl} AS "thumbnailUrl",
      ${videos.channelTitle} AS "channelTitle"
    FROM ${segments}
    INNER JOIN ${videos} ON ${segments.videoId} = ${videos.id}
    ${tagJoin}
    WHERE
      to_tsvector('english', ${segments.text}) @@ ${tsquery}
      AND ${videos.organizationId} = ${organizationId}
      AND ${videos.deletedAt} IS NULL
    ORDER BY "rank" DESC
    LIMIT ${limit}
  `);

  return rows.rows;
}

export type SemanticResult = {
  windowId: number;
  videoId: number;
  text: string;
  startSeconds: number;
  endSeconds: number;
  similarity: number;
  videoTitle: string | null;
  youtubeVideoId: string;
  thumbnailUrl: string | null;
  channelTitle: string | null;
};

export async function semanticSearchSegments(
  query: string,
  organizationId: number,
  limit: number = 20,
  tagSlug?: string,
): Promise<SemanticResult[]> {
  const embeddingResult = await mistral.embeddings.create({
    model: "mistral-embed",
    inputs: [query],
  });
  const queryEmbedding = embeddingResult.data[0].embedding as number[];
  const vectorLiteral = `[${queryEmbedding.join(",")}]`;

  const tagJoin = tagSlug
    ? sql`INNER JOIN ${videoTags} ON ${videoTags.videoId} = ${videos.id}
           INNER JOIN ${tags} ON ${videoTags.tagId} = ${tags.id} AND ${tags.slug} = ${tagSlug}`
    : sql``;

  const rows = await db.execute<SemanticResult>(sql`
    SELECT
      ${windows.id} AS "windowId",
      ${windows.videoId} AS "videoId",
      ${windows.text} AS "text",
      ${windows.startSeconds} AS "startSeconds",
      ${windows.endSeconds} AS "endSeconds",
      1 - (${windows.embedding} <=> ${sql.raw(`'${vectorLiteral}'::vector`)}) AS "similarity",
      ${videos.title} AS "videoTitle",
      ${videos.youtubeVideoId} AS "youtubeVideoId",
      ${videos.thumbnailUrl} AS "thumbnailUrl",
      ${videos.channelTitle} AS "channelTitle"
    FROM ${windows}
    INNER JOIN ${videos} ON ${windows.videoId} = ${videos.id}
    ${tagJoin}
    WHERE
      ${windows.embedding} IS NOT NULL
      AND ${videos.organizationId} = ${organizationId}
      AND ${videos.deletedAt} IS NULL
    ORDER BY ${windows.embedding} <=> ${sql.raw(`'${vectorLiteral}'::vector`)}
    LIMIT ${limit}
  `);

  return rows.rows;
}
