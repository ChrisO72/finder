import { eq, sql } from "drizzle-orm";
import { db } from "../db";
import { episodes } from "../schema/episodes";
import { type InsertSegment, segments } from "../schema/segments";
import { episodeTags, tags } from "../schema/tags";
import { windows } from "../schema/windows";

export async function bulkInsertSegments(rows: InsertSegment[]) {
  if (rows.length === 0) return [];
  return await db.insert(segments).values(rows).returning();
}

export async function getSegmentsByEpisodeId(episodeId: number) {
  return await db
    .select()
    .from(segments)
    .where(eq(segments.episodeId, episodeId))
    .orderBy(segments.startSeconds);
}

export type SearchResult = {
  segmentId: number;
  episodeId: number;
  text: string;
  headline: string;
  startSeconds: number;
  endSeconds: number;
  rank: number;
  episodeTitle: string;
  artworkUrl: string | null;
  podcastTitle: string;
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
      ${segments.episodeId} AS "episodeId",
      ${segments.text} AS "text",
      ts_headline('english', ${segments.text}, ${tsquery},
        'StartSel=<mark>, StopSel=</mark>, MaxFragments=2, MaxWords=30, MinWords=15'
      ) AS "headline",
      ${segments.startSeconds} AS "startSeconds",
      ${segments.endSeconds} AS "endSeconds",
      ts_rank(to_tsvector('english', ${segments.text}), ${tsquery}) AS "rank",
      ${episodes.title} AS "episodeTitle",
      ${episodes.artworkUrl} AS "artworkUrl",
      ${episodes.podcastTitle} AS "podcastTitle"
    FROM ${segments}
    INNER JOIN ${episodes} ON ${segments.episodeId} = ${episodes.id}
    ${tagJoin}
    WHERE
      to_tsvector('english', ${segments.text}) @@ ${tsquery}
      AND ${episodes.organizationId} = ${organizationId}
      AND ${episodes.deletedAt} IS NULL
    ORDER BY "rank" DESC
    LIMIT ${limit}
  `);

  return rows.rows;
}

export type SemanticResult = {
  windowId: number;
  episodeId: number;
  text: string;
  startSeconds: number;
  endSeconds: number;
  similarity: number;
  episodeTitle: string;
  artworkUrl: string | null;
  podcastTitle: string;
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
      ${windows.episodeId} AS "episodeId",
      ${windows.text} AS "text",
      ${windows.startSeconds} AS "startSeconds",
      ${windows.endSeconds} AS "endSeconds",
      1 - (${windows.embedding} <=> ${vectorValue}) AS "similarity",
      ${episodes.title} AS "episodeTitle",
      ${episodes.artworkUrl} AS "artworkUrl",
      ${episodes.podcastTitle} AS "podcastTitle"
    FROM ${windows}
    INNER JOIN ${episodes} ON ${windows.episodeId} = ${episodes.id}
    ${tagJoin}
    WHERE
      ${windows.embedding} IS NOT NULL
      AND ${episodes.organizationId} = ${organizationId}
      AND ${episodes.deletedAt} IS NULL
    ORDER BY ${windows.embedding} <=> ${vectorValue}
    LIMIT ${limit}
  `);

  return rows.rows;
}

export type EpisodeSearchResult = {
  episodeId: number;
  summary: string;
  headline: string;
  rank: number;
  episodeTitle: string;
  artworkUrl: string | null;
  podcastTitle: string;
};

export async function searchEpisodeSummaries(
  query: string,
  organizationId: number,
  limit: number = 20,
  tagSlug?: string,
): Promise<EpisodeSearchResult[]> {
  const tsquery = sql`plainto_tsquery('english', ${query})`;
  const tagJoin = getTagJoin(tagSlug);

  const rows = await db.execute<EpisodeSearchResult>(sql`
    SELECT
      ${episodes.id} AS "episodeId",
      ${episodes.summary} AS "summary",
      ts_headline('english', ${episodes.summary}, ${tsquery},
        'StartSel=<mark>, StopSel=</mark>, MaxFragments=2, MaxWords=30, MinWords=15'
      ) AS "headline",
      ts_rank(to_tsvector('english', ${episodes.summary}), ${tsquery}) AS "rank",
      ${episodes.title} AS "episodeTitle",
      ${episodes.artworkUrl} AS "artworkUrl",
      ${episodes.podcastTitle} AS "podcastTitle"
    FROM ${episodes}
    ${tagJoin}
    WHERE
      ${episodes.summary} IS NOT NULL
      AND to_tsvector('english', ${episodes.summary}) @@ ${tsquery}
      AND ${episodes.organizationId} = ${organizationId}
      AND ${episodes.deletedAt} IS NULL
    ORDER BY "rank" DESC
    LIMIT ${limit}
  `);

  return rows.rows;
}

export type EpisodeSemanticResult = {
  episodeId: number;
  summary: string;
  similarity: number;
  episodeTitle: string;
  artworkUrl: string | null;
  podcastTitle: string;
};

export async function semanticSearchEpisodeSummaries(
  queryEmbedding: number[],
  organizationId: number,
  limit: number = 20,
  tagSlug?: string,
): Promise<EpisodeSemanticResult[]> {
  const vectorValue = sql`${toVectorLiteral(queryEmbedding)}::vector`;
  const tagJoin = getTagJoin(tagSlug);

  const rows = await db.execute<EpisodeSemanticResult>(sql`
    SELECT
      ${episodes.id} AS "episodeId",
      ${episodes.summary} AS "summary",
      1 - (${episodes.summaryEmbedding} <=> ${vectorValue}) AS "similarity",
      ${episodes.title} AS "episodeTitle",
      ${episodes.artworkUrl} AS "artworkUrl",
      ${episodes.podcastTitle} AS "podcastTitle"
    FROM ${episodes}
    ${tagJoin}
    WHERE
      ${episodes.summaryEmbedding} IS NOT NULL
      AND ${episodes.organizationId} = ${organizationId}
      AND ${episodes.deletedAt} IS NULL
    ORDER BY ${episodes.summaryEmbedding} <=> ${vectorValue}
    LIMIT ${limit}
  `);

  return rows.rows;
}

function getTagJoin(tagSlug?: string) {
  return tagSlug
    ? sql`INNER JOIN ${episodeTags} ON ${episodeTags.episodeId} = ${episodes.id}
           INNER JOIN ${tags} ON ${episodeTags.tagId} = ${tags.id} AND ${tags.slug} = ${tagSlug}`
    : sql``;
}

function toVectorLiteral(embedding: number[]): string {
  if (embedding.length === 0 || !embedding.every(Number.isFinite)) {
    throw new Error("Query embedding must contain finite numbers");
  }
  return `[${embedding.join(",")}]`;
}
