import { Mistral } from "@mistralai/mistralai";
import {
  searchEpisodeSummaries,
  searchSegments,
  semanticSearchEpisodeSummaries,
  semanticSearchSegments,
} from "~/db/repositories/segments";
import { env } from "~/env.server";

const mistral = new Mistral({ apiKey: env.MISTRAL_API_KEY });

export type HybridResult = {
  episodeId: number;
  text: string;
  headline: string | null;
  startSeconds: number;
  endSeconds: number;
  score: number;
  episodeTitle: string;
  artworkUrl: string | null;
  podcastTitle: string;
  source: "keyword" | "semantic" | "both";
  segmentId: number | null;
};

export async function createQueryEmbedding(query: string): Promise<number[]> {
  const result = await mistral.embeddings.create({
    model: "mistral-embed",
    inputs: [query],
  });
  const embedding = result.data[0]?.embedding;
  if (!embedding) {
    throw new Error("Mistral did not return a query embedding");
  }
  return embedding;
}

export async function hybridSearch(
  query: string,
  organizationId: number,
  limit: number = 20,
  tagSlug?: string,
): Promise<HybridResult[]> {
  const queryEmbedding = await createQueryEmbedding(query);
  const [kwSegments, semSegments, kwEpisodes, semEpisodes] = await Promise.all([
    searchSegments(query, organizationId, limit, tagSlug),
    semanticSearchSegments(queryEmbedding, organizationId, limit, tagSlug),
    searchEpisodeSummaries(query, organizationId, limit, tagSlug),
    semanticSearchEpisodeSummaries(queryEmbedding, organizationId, limit, tagSlug),
  ]);

  const k = 60;
  const bucketSize = 30;
  const results = new Map<string, HybridResult>();
  const segmentBucketKey = (episodeId: number, startSeconds: number) =>
    `${episodeId}:${Math.floor(startSeconds / bucketSize)}`;
  const summaryBucketKey = (episodeId: number) => `${episodeId}:summary`;

  function upsert(key: string, score: number, entry: HybridResult) {
    const existing = results.get(key);
    if (!existing) {
      results.set(key, entry);
      return;
    }

    existing.score += score;
    if (existing.source !== entry.source) existing.source = "both";
    existing.headline ??= entry.headline;
    existing.segmentId ??= entry.segmentId;
  }

  kwSegments.forEach((result, index) => {
    const score = 1 / (k + index + 1);
    upsert(segmentBucketKey(result.episodeId, result.startSeconds), score, {
      episodeId: result.episodeId,
      text: result.text,
      headline: result.headline,
      startSeconds: result.startSeconds,
      endSeconds: result.endSeconds,
      score,
      episodeTitle: result.episodeTitle,
      artworkUrl: result.artworkUrl,
      podcastTitle: result.podcastTitle,
      source: "keyword",
      segmentId: result.segmentId,
    });
  });

  semSegments.forEach((result, index) => {
    const score = 1 / (k + index + 1);
    upsert(segmentBucketKey(result.episodeId, result.startSeconds), score, {
      episodeId: result.episodeId,
      text: result.text,
      headline: null,
      startSeconds: result.startSeconds,
      endSeconds: result.endSeconds,
      score,
      episodeTitle: result.episodeTitle,
      artworkUrl: result.artworkUrl,
      podcastTitle: result.podcastTitle,
      source: "semantic",
      segmentId: null,
    });
  });

  kwEpisodes.forEach((result, index) => {
    const score = 1 / (k + index + 1);
    upsert(summaryBucketKey(result.episodeId), score, {
      episodeId: result.episodeId,
      text: result.summary,
      headline: result.headline,
      startSeconds: 0,
      endSeconds: 0,
      score,
      episodeTitle: result.episodeTitle,
      artworkUrl: result.artworkUrl,
      podcastTitle: result.podcastTitle,
      source: "keyword",
      segmentId: null,
    });
  });

  semEpisodes.forEach((result, index) => {
    const score = 1 / (k + index + 1);
    upsert(summaryBucketKey(result.episodeId), score, {
      episodeId: result.episodeId,
      text: result.summary,
      headline: null,
      startSeconds: 0,
      endSeconds: 0,
      score,
      episodeTitle: result.episodeTitle,
      artworkUrl: result.artworkUrl,
      podcastTitle: result.podcastTitle,
      source: "semantic",
      segmentId: null,
    });
  });

  return [...results.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}
