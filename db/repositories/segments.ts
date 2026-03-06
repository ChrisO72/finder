import { eq, sql, desc } from "drizzle-orm";
import { db } from "../db";
import { type InsertSegment, segments, videos } from "../schema";

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
): Promise<SearchResult[]> {
  const tsquery = sql`plainto_tsquery('english', ${query})`;

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
    WHERE
      to_tsvector('english', ${segments.text}) @@ ${tsquery}
      AND ${videos.organizationId} = ${organizationId}
      AND ${videos.deletedAt} IS NULL
    ORDER BY "rank" DESC
    LIMIT ${limit}
  `);

  return rows.rows;
}
