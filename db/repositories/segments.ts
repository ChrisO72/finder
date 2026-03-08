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
  precomputedEmbedding?: number[],
): Promise<SemanticResult[]> {
  let queryEmbedding = precomputedEmbedding;
  if (!queryEmbedding) {
    const embeddingResult = await mistral.embeddings.create({
      model: "mistral-embed",
      inputs: [query],
    });
    queryEmbedding = embeddingResult.data[0].embedding as number[];
  }
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

  const tagJoin = tagSlug
    ? sql`INNER JOIN ${videoTags} ON ${videoTags.videoId} = ${videos.id}
           INNER JOIN ${tags} ON ${videoTags.tagId} = ${tags.id} AND ${tags.slug} = ${tagSlug}`
    : sql``;

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
  query: string,
  organizationId: number,
  limit: number = 20,
  tagSlug?: string,
  precomputedEmbedding?: number[],
): Promise<VideoSemanticResult[]> {
  let queryEmbedding = precomputedEmbedding;
  if (!queryEmbedding) {
    const embeddingResult = await mistral.embeddings.create({
      model: "mistral-embed",
      inputs: [query],
    });
    queryEmbedding = embeddingResult.data[0].embedding as number[];
  }
  const vectorLiteral = `[${queryEmbedding.join(",")}]`;

  const tagJoin = tagSlug
    ? sql`INNER JOIN ${videoTags} ON ${videoTags.videoId} = ${videos.id}
           INNER JOIN ${tags} ON ${videoTags.tagId} = ${tags.id} AND ${tags.slug} = ${tagSlug}`
    : sql``;

  const rows = await db.execute<VideoSemanticResult>(sql`
    SELECT
      ${videos.id} AS "videoId",
      ${videos.summary} AS "summary",
      1 - (${videos.summaryEmbedding} <=> ${sql.raw(`'${vectorLiteral}'::vector`)}) AS "similarity",
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
    ORDER BY ${videos.summaryEmbedding} <=> ${sql.raw(`'${vectorLiteral}'::vector`)}
    LIMIT ${limit}
  `);

  return rows.rows;
}

export type HybridResult = {
  videoId: number;
  text: string;
  headline: string | null;
  startSeconds: number;
  endSeconds: number;
  score: number;
  videoTitle: string | null;
  youtubeVideoId: string;
  thumbnailUrl: string | null;
  channelTitle: string | null;
  source: "keyword" | "semantic" | "both";
  segmentId: number | null;
};

export async function hybridSearch(
  query: string,
  organizationId: number,
  limit: number = 20,
  tagSlug?: string,
): Promise<HybridResult[]> {
  const embeddingResult = await mistral.embeddings.create({
    model: "mistral-embed",
    inputs: [query],
  });
  const queryEmbedding = embeddingResult.data[0].embedding as number[];

  const [kwSegments, semSegments, kwVideos, semVideos] = await Promise.all([
    searchSegments(query, organizationId, limit, tagSlug),
    semanticSearchSegments(query, organizationId, limit, tagSlug, queryEmbedding),
    searchVideoSummaries(query, organizationId, limit, tagSlug),
    semanticSearchVideoSummaries(query, organizationId, limit, tagSlug, queryEmbedding),
  ]);

  const k = 60;
  const bucketSize = 30;
  const map = new Map<string, HybridResult>();

  const segmentBucketKey = (videoId: number, startSeconds: number) =>
    `${videoId}:${Math.floor(startSeconds / bucketSize)}`;

  const summaryBucketKey = (videoId: number) => `${videoId}:summary`;

  function upsert(key: string, rrfScore: number, entry: HybridResult) {
    const existing = map.get(key);
    if (existing) {
      existing.score += rrfScore;
      if (existing.source !== entry.source) existing.source = "both";
      existing.headline = existing.headline ?? entry.headline;
      existing.segmentId = existing.segmentId ?? entry.segmentId;
    } else {
      map.set(key, entry);
    }
  }

  kwSegments.forEach((r, i) => {
    const key = segmentBucketKey(r.videoId, r.startSeconds);
    const rrfScore = 1 / (k + i + 1);
    upsert(key, rrfScore, {
      videoId: r.videoId,
      text: r.text,
      headline: r.headline,
      startSeconds: r.startSeconds,
      endSeconds: r.endSeconds,
      score: rrfScore,
      videoTitle: r.videoTitle,
      youtubeVideoId: r.youtubeVideoId,
      thumbnailUrl: r.thumbnailUrl,
      channelTitle: r.channelTitle,
      source: "keyword",
      segmentId: r.segmentId,
    });
  });

  semSegments.forEach((r, i) => {
    const key = segmentBucketKey(r.videoId, r.startSeconds);
    const rrfScore = 1 / (k + i + 1);
    upsert(key, rrfScore, {
      videoId: r.videoId,
      text: r.text,
      headline: null,
      startSeconds: r.startSeconds,
      endSeconds: r.endSeconds,
      score: rrfScore,
      videoTitle: r.videoTitle,
      youtubeVideoId: r.youtubeVideoId,
      thumbnailUrl: r.thumbnailUrl,
      channelTitle: r.channelTitle,
      source: "semantic",
      segmentId: null,
    });
  });

  kwVideos.forEach((r, i) => {
    const key = summaryBucketKey(r.videoId);
    const rrfScore = 1 / (k + i + 1);
    upsert(key, rrfScore, {
      videoId: r.videoId,
      text: r.summary,
      headline: r.headline,
      startSeconds: 0,
      endSeconds: 0,
      score: rrfScore,
      videoTitle: r.videoTitle,
      youtubeVideoId: r.youtubeVideoId,
      thumbnailUrl: r.thumbnailUrl,
      channelTitle: r.channelTitle,
      source: "keyword",
      segmentId: null,
    });
  });

  semVideos.forEach((r, i) => {
    const key = summaryBucketKey(r.videoId);
    const rrfScore = 1 / (k + i + 1);
    upsert(key, rrfScore, {
      videoId: r.videoId,
      text: r.summary,
      headline: null,
      startSeconds: 0,
      endSeconds: 0,
      score: rrfScore,
      videoTitle: r.videoTitle,
      youtubeVideoId: r.youtubeVideoId,
      thumbnailUrl: r.thumbnailUrl,
      channelTitle: r.channelTitle,
      source: "semantic",
      segmentId: null,
    });
  });

  return [...map.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
