import { eq, sql, desc } from "drizzle-orm";
import { Mistral } from "@mistralai/mistralai";
import { db } from "../db";
import { type InsertSegment, segments, videos } from "../schema";

const mistral = new Mistral({ apiKey: process.env.MISTRAL_API_KEY! });

export async function bulkInsertSegments(rows: InsertSegment[]) {
  if (rows.length === 0) return [];
  return await db.insert(segments).values(rows).returning();
}

export async function updateSegmentEmbeddings(
  updates: { id: number; embedding: number[] }[],
) {
  if (updates.length === 0) return;
  await Promise.all(
    updates.map(({ id, embedding }) =>
      db
        .update(segments)
        .set({ embedding })
        .where(eq(segments.id, id)),
    ),
  );
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

type SemanticSegmentRow = {
  segmentId: number;
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

export type SemanticChunk = {
  videoId: number;
  videoTitle: string | null;
  youtubeVideoId: string;
  thumbnailUrl: string | null;
  channelTitle: string | null;
  startSeconds: number;
  endSeconds: number;
  segmentCount: number;
  score: number;
  texts: string[];
};

const CHUNK_GAP_SECONDS = 30;

function bundleIntoChunks(rows: SemanticSegmentRow[]): SemanticChunk[] {
  const byVideo = new Map<number, SemanticSegmentRow[]>();
  for (const row of rows) {
    const arr = byVideo.get(row.videoId) ?? [];
    arr.push(row);
    byVideo.set(row.videoId, arr);
  }

  const chunks: SemanticChunk[] = [];

  for (const [, videoRows] of byVideo) {
    videoRows.sort((a, b) => a.startSeconds - b.startSeconds);

    let chunk: SemanticChunk | null = null;
    let similaritySum = 0;

    for (const row of videoRows) {
      if (
        chunk &&
        row.startSeconds - chunk.endSeconds <= CHUNK_GAP_SECONDS
      ) {
        chunk.endSeconds = row.endSeconds;
        chunk.segmentCount++;
        chunk.texts.push(row.text);
        similaritySum += row.similarity;
        chunk.score = chunk.segmentCount * (similaritySum / chunk.segmentCount);
      } else {
        if (chunk) chunks.push(chunk);
        similaritySum = row.similarity;
        chunk = {
          videoId: row.videoId,
          videoTitle: row.videoTitle,
          youtubeVideoId: row.youtubeVideoId,
          thumbnailUrl: row.thumbnailUrl,
          channelTitle: row.channelTitle,
          startSeconds: row.startSeconds,
          endSeconds: row.endSeconds,
          segmentCount: 1,
          score: row.similarity,
          texts: [row.text],
        };
      }
    }
    if (chunk) chunks.push(chunk);
  }

  chunks.sort((a, b) => b.score - a.score);
  return chunks;
}

export async function semanticSearchSegments(
  query: string,
  organizationId: number,
  limit: number = 50,
): Promise<SemanticChunk[]> {
  const embeddingResult = await mistral.embeddings.create({
    model: "mistral-embed",
    inputs: [query],
  });
  const queryEmbedding = embeddingResult.data[0].embedding as number[];
  const vectorLiteral = `[${queryEmbedding.join(",")}]`;

  const rows = await db.execute<SemanticSegmentRow>(sql`
    SELECT
      ${segments.id} AS "segmentId",
      ${segments.videoId} AS "videoId",
      ${segments.text} AS "text",
      ${segments.startSeconds} AS "startSeconds",
      ${segments.endSeconds} AS "endSeconds",
      1 - (${segments.embedding} <=> ${sql.raw(`'${vectorLiteral}'::vector`)}) AS "similarity",
      ${videos.title} AS "videoTitle",
      ${videos.youtubeVideoId} AS "youtubeVideoId",
      ${videos.thumbnailUrl} AS "thumbnailUrl",
      ${videos.channelTitle} AS "channelTitle"
    FROM ${segments}
    INNER JOIN ${videos} ON ${segments.videoId} = ${videos.id}
    WHERE
      ${segments.embedding} IS NOT NULL
      AND ${videos.organizationId} = ${organizationId}
      AND ${videos.deletedAt} IS NULL
    ORDER BY ${segments.embedding} <=> ${sql.raw(`'${vectorLiteral}'::vector`)}
    LIMIT ${limit}
  `);

  return bundleIntoChunks(rows.rows);
}
