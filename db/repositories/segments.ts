import { eq, sql } from "drizzle-orm";
import { db } from "../db";
import { type InsertSegment, segments } from "../schema/segments";
import { tags, videoTags } from "../schema/tags";
import { videos } from "../schema/videos";
import { windows } from "../schema/windows";

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
  const tagJoin = getTagJoin(tagSlug);

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
  queryEmbedding: number[],
  organizationId: number,
  limit: number = 20,
  tagSlug?: string,
): Promise<SemanticResult[]> {
  const vectorValue = sql`${toVectorLiteral(queryEmbedding)}::vector`;
  const tagJoin = getTagJoin(tagSlug);

  const rows = await db.execute<SemanticResult>(sql`
    SELECT
      ${windows.id} AS "windowId",
      ${windows.videoId} AS "videoId",
      ${windows.text} AS "text",
      ${windows.startSeconds} AS "startSeconds",
      ${windows.endSeconds} AS "endSeconds",
      1 - (${windows.embedding} <=> ${vectorValue}) AS "similarity",
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
    ORDER BY ${windows.embedding} <=> ${vectorValue}
    LIMIT ${limit}
  `);

  return rows.rows;
}

export type VideoSearchResult = {
  videoId: number;
  summary: string;
  headline: string;
  rank: number;
  videoTitle: string | null;
  youtubeVideoId: string;
  thumbnailUrl: string | null;
  channelTitle: string | null;
};

export async function searchVideoSummaries(
  query: string,
  organizationId: number,
  limit: number = 20,
  tagSlug?: string,
): Promise<VideoSearchResult[]> {
  const tsquery = sql`plainto_tsquery('english', ${query})`;
  const tagJoin = getTagJoin(tagSlug);

  const rows = await db.execute<VideoSearchResult>(sql`
    SELECT
      ${videos.id} AS "videoId",
      ${videos.summary} AS "summary",
      ts_headline('english', ${videos.summary}, ${tsquery},
        'StartSel=<mark>, StopSel=</mark>, MaxFragments=2, MaxWords=30, MinWords=15'
      ) AS "headline",
      ts_rank(to_tsvector('english', ${videos.summary}), ${tsquery}) AS "rank",
      ${videos.title} AS "videoTitle",
      ${videos.youtubeVideoId} AS "youtubeVideoId",
      ${videos.thumbnailUrl} AS "thumbnailUrl",
      ${videos.channelTitle} AS "channelTitle"
    FROM ${videos}
    ${tagJoin}
    WHERE
      ${videos.summary} IS NOT NULL
      AND to_tsvector('english', ${videos.summary}) @@ ${tsquery}
      AND ${videos.organizationId} = ${organizationId}
      AND ${videos.deletedAt} IS NULL
    ORDER BY "rank" DESC
    LIMIT ${limit}
  `);

  return rows.rows;
}

export type VideoSemanticResult = {
  videoId: number;
  summary: string;
  similarity: number;
  videoTitle: string | null;
  youtubeVideoId: string;
  thumbnailUrl: string | null;
  channelTitle: string | null;
};

export async function semanticSearchVideoSummaries(
  queryEmbedding: number[],
  organizationId: number,
  limit: number = 20,
  tagSlug?: string,
): Promise<VideoSemanticResult[]> {
  const vectorValue = sql`${toVectorLiteral(queryEmbedding)}::vector`;
  const tagJoin = getTagJoin(tagSlug);

  const rows = await db.execute<VideoSemanticResult>(sql`
    SELECT
      ${videos.id} AS "videoId",
      ${videos.summary} AS "summary",
      1 - (${videos.summaryEmbedding} <=> ${vectorValue}) AS "similarity",
      ${videos.title} AS "videoTitle",
      ${videos.youtubeVideoId} AS "youtubeVideoId",
      ${videos.thumbnailUrl} AS "thumbnailUrl",
      ${videos.channelTitle} AS "channelTitle"
    FROM ${videos}
    ${tagJoin}
    WHERE
      ${videos.summaryEmbedding} IS NOT NULL
      AND ${videos.organizationId} = ${organizationId}
      AND ${videos.deletedAt} IS NULL
    ORDER BY ${videos.summaryEmbedding} <=> ${vectorValue}
    LIMIT ${limit}
  `);

  return rows.rows;
}

function getTagJoin(tagSlug?: string) {
  return tagSlug
    ? sql`INNER JOIN ${videoTags} ON ${videoTags.videoId} = ${videos.id}
           INNER JOIN ${tags} ON ${videoTags.tagId} = ${tags.id} AND ${tags.slug} = ${tagSlug}`
    : sql``;
}

function toVectorLiteral(embedding: number[]): string {
  if (embedding.length === 0 || !embedding.every(Number.isFinite)) {
    throw new Error("Query embedding must contain finite numbers");
  }
  return `[${embedding.join(",")}]`;
}
