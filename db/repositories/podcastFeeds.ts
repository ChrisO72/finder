import { and, desc, eq } from "drizzle-orm";
import { db } from "../db";
import {
  type InsertPodcastFeed,
  podcastFeeds,
  type SelectPodcastFeed,
} from "../schema/podcastFeeds";

export async function createPodcastFeed(feed: InsertPodcastFeed) {
  const [row] = await db.insert(podcastFeeds).values(feed).returning();
  return row;
}

export async function getPodcastFeedByUrl(organizationId: number, feedUrl: string) {
  const [row] = await db
    .select()
    .from(podcastFeeds)
    .where(and(eq(podcastFeeds.organizationId, organizationId), eq(podcastFeeds.feedUrl, feedUrl)))
    .limit(1);
  return row ?? null;
}

export async function getPodcastFeedByIdForOrg(id: number, organizationId: number) {
  const [row] = await db
    .select()
    .from(podcastFeeds)
    .where(and(eq(podcastFeeds.id, id), eq(podcastFeeds.organizationId, organizationId)))
    .limit(1);
  return row ?? null;
}

export async function listPodcastFeedsByOrg(organizationId: number) {
  return await db
    .select()
    .from(podcastFeeds)
    .where(eq(podcastFeeds.organizationId, organizationId))
    .orderBy(desc(podcastFeeds.createdAt));
}

export async function updatePodcastFeed(
  id: number,
  organizationId: number,
  data: Partial<Pick<SelectPodcastFeed, "title" | "description" | "artworkUrl" | "lastSyncedAt">>,
) {
  const [row] = await db
    .update(podcastFeeds)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(podcastFeeds.id, id), eq(podcastFeeds.organizationId, organizationId)))
    .returning();
  return row ?? null;
}
