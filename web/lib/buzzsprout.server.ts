import { XMLParser } from "fast-xml-parser";
import { createEpisode, getEpisodeByFeedAndGuid, updateEpisode } from "~/db/repositories/episodes";
import {
  createPodcastFeed,
  getPodcastFeedByIdForOrg,
  getPodcastFeedByUrl,
  updatePodcastFeed,
} from "~/db/repositories/podcastFeeds";
import { enqueueJob } from "~/worker/enqueue";
import { processEpisodeJobName } from "~/worker/jobs/process-episode";

const MAX_FEED_BYTES = 5 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 15_000;

type XmlRecord = Record<string, unknown>;

export type ParsedEpisode = {
  guid: string;
  title: string;
  description: string | null;
  episodeUrl: string | null;
  audioUrl: string;
  audioMimeType: string | null;
  artworkUrl: string | null;
  durationSeconds: number | null;
  publishedAt: Date | null;
};

export type ParsedPodcastFeed = {
  feedUrl: string;
  title: string;
  description: string | null;
  artworkUrl: string | null;
  episodes: ParsedEpisode[];
};

export type FeedSyncResult = {
  feedId: number;
  importedCount: number;
  updatedCount: number;
};

export async function addAndSyncPodcastFeed(
  organizationId: number,
  feedUrl: string,
): Promise<FeedSyncResult> {
  const parsed = await fetchBuzzsproutFeed(feedUrl);
  let feed = await getPodcastFeedByUrl(organizationId, parsed.feedUrl);

  if (!feed) {
    feed = await createPodcastFeed({
      organizationId,
      feedUrl: parsed.feedUrl,
      title: parsed.title,
      description: parsed.description,
      artworkUrl: parsed.artworkUrl,
    });
  }

  return await persistFeedSync(organizationId, feed.id, parsed);
}

export async function syncPodcastFeed(
  organizationId: number,
  feedId: number,
): Promise<FeedSyncResult> {
  const feed = await getPodcastFeedByIdForOrg(feedId, organizationId);
  if (!feed) {
    throw new Error("Podcast feed not found");
  }

  const parsed = await fetchBuzzsproutFeed(feed.feedUrl);
  return await persistFeedSync(organizationId, feed.id, parsed);
}

async function persistFeedSync(
  organizationId: number,
  feedId: number,
  parsed: ParsedPodcastFeed,
): Promise<FeedSyncResult> {
  let importedCount = 0;
  let updatedCount = 0;

  await updatePodcastFeed(feedId, organizationId, {
    title: parsed.title,
    description: parsed.description,
    artworkUrl: parsed.artworkUrl,
    lastSyncedAt: new Date(),
  });

  for (const item of parsed.episodes) {
    const existing = await getEpisodeByFeedAndGuid(feedId, item.guid);
    if (existing) {
      await updateEpisode(existing.id, {
        episodeUrl: item.episodeUrl,
        audioUrl: item.audioUrl,
        audioMimeType: item.audioMimeType,
        title: item.title,
        podcastTitle: parsed.title,
        description: item.description,
        artworkUrl: item.artworkUrl ?? parsed.artworkUrl,
        durationSeconds: item.durationSeconds,
        publishedAt: item.publishedAt,
      });
      updatedCount += 1;
      continue;
    }

    const episode = await createEpisode({
      organizationId,
      feedId,
      guid: item.guid,
      episodeUrl: item.episodeUrl,
      audioUrl: item.audioUrl,
      audioMimeType: item.audioMimeType,
      title: item.title,
      podcastTitle: parsed.title,
      description: item.description,
      artworkUrl: item.artworkUrl ?? parsed.artworkUrl,
      durationSeconds: item.durationSeconds,
      publishedAt: item.publishedAt,
    });
    await enqueueJob(processEpisodeJobName, { episodeId: episode.id });
    importedCount += 1;
  }

  return { feedId, importedCount, updatedCount };
}

export async function fetchBuzzsproutFeed(feedUrl: string): Promise<ParsedPodcastFeed> {
  const url = validateBuzzsproutUrl(feedUrl, "RSS feed");
  const response = await fetch(url, {
    headers: {
      Accept: "application/rss+xml, application/xml, text/xml",
      "User-Agent": "Finder/1.0 RSS importer",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Buzzsprout returned ${response.status} while fetching the feed`);
  }

  const finalUrl = validateBuzzsproutUrl(response.url, "RSS feed");
  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > MAX_FEED_BYTES) {
    throw new Error("The RSS feed is too large");
  }

  const xml = await response.text();
  if (Buffer.byteLength(xml, "utf8") > MAX_FEED_BYTES) {
    throw new Error("The RSS feed is too large");
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    trimValues: true,
  });
  const document: unknown = parser.parse(xml);
  const rss = asRecord(asRecord(document)?.rss);
  const channel = asRecord(rss?.channel);
  if (!channel) {
    throw new Error("This URL does not contain a valid podcast RSS feed");
  }

  const title = nodeText(channel.title);
  if (!title) {
    throw new Error("The podcast feed is missing a title");
  }

  const artworkUrl =
    attribute(asRecord(channel["itunes:image"]), "href") ??
    nodeText(asRecord(channel.image)?.url) ??
    null;
  const rawItems = channel.item;
  const items = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];
  const episodes = items.map(parseEpisode).filter((item): item is ParsedEpisode => item !== null);

  if (episodes.length === 0) {
    throw new Error("The feed does not contain any public Buzzsprout audio episodes");
  }

  return {
    feedUrl: finalUrl.toString(),
    title,
    description: nodeText(channel.description) || null,
    artworkUrl: safePublicUrl(artworkUrl),
    episodes,
  };
}

function parseEpisode(value: unknown): ParsedEpisode | null {
  const item = asRecord(value);
  if (!item) return null;

  const enclosure = asRecord(item.enclosure);
  const rawAudioUrl = attribute(enclosure, "url");
  if (!rawAudioUrl) return null;

  let audioUrl: string;
  try {
    audioUrl = validateBuzzsproutUrl(rawAudioUrl, "audio enclosure").toString();
  } catch {
    return null;
  }

  const title = nodeText(item["itunes:title"]) || nodeText(item.title);
  if (!title) return null;

  const guid = nodeText(item.guid) || audioUrl;
  const publishedAt = parseDate(nodeText(item.pubDate));
  const itemArtwork = attribute(asRecord(item["itunes:image"]), "href");

  return {
    guid,
    title,
    description:
      nodeText(item["content:encoded"]) ||
      nodeText(item.description) ||
      nodeText(item.summary) ||
      null,
    episodeUrl: safePublicUrl(nodeText(item.link)),
    audioUrl,
    audioMimeType: attribute(enclosure, "type"),
    artworkUrl: safePublicUrl(itemArtwork),
    durationSeconds: parseDuration(nodeText(item["itunes:duration"])),
    publishedAt,
  };
}

function validateBuzzsproutUrl(value: string, label: string): URL {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error(`Please enter a valid Buzzsprout ${label} URL`);
  }

  const hostname = url.hostname.toLowerCase();
  if (
    url.protocol !== "https:" ||
    (hostname !== "buzzsprout.com" && !hostname.endsWith(".buzzsprout.com"))
  ) {
    throw new Error(`${label} URLs must use public HTTPS links hosted by Buzzsprout`);
  }
  return url;
}

function safePublicUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function parseDuration(value: string): number | null {
  if (!value) return null;
  const parts = value.split(":").map(Number);
  if (parts.some((part) => !Number.isFinite(part) || part < 0)) return null;
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

function parseDate(value: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function asRecord(value: unknown): XmlRecord | null {
  return typeof value === "object" && value !== null ? (value as XmlRecord) : null;
}

function attribute(value: XmlRecord | null, name: string): string | null {
  return nodeText(value?.[name]) || null;
}

function nodeText(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  const record = asRecord(value);
  return record ? nodeText(record["#text"]) : "";
}
