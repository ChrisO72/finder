import { and, count, desc, eq, isNull } from "drizzle-orm";
import { db } from "../db";
import { episodes, type InsertEpisode } from "../schema/episodes";

export async function createEpisode(episode: InsertEpisode) {
  const [row] = await db.insert(episodes).values(episode).returning();
  return row;
}

export async function getEpisodeByFeedAndGuid(feedId: number, guid: string) {
  const [row] = await db
    .select()
    .from(episodes)
    .where(and(eq(episodes.feedId, feedId), eq(episodes.guid, guid)))
    .limit(1);
  return row ?? null;
}

export async function getEpisodeById(id: number) {
  const [row] = await db
    .select()
    .from(episodes)
    .where(and(eq(episodes.id, id), isNull(episodes.deletedAt)))
    .limit(1);
  return row ?? null;
}

export async function getEpisodeByIdForOrg(id: number, organizationId: number) {
  const [row] = await db
    .select()
    .from(episodes)
    .where(
      and(
        eq(episodes.id, id),
        eq(episodes.organizationId, organizationId),
        isNull(episodes.deletedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function updateEpisode(id: number, data: Partial<InsertEpisode>) {
  const [row] = await db
    .update(episodes)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(episodes.id, id))
    .returning();
  return row ?? null;
}

export async function softDeleteEpisode(id: number, organizationId: number) {
  const [row] = await db
    .update(episodes)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(episodes.id, id),
        eq(episodes.organizationId, organizationId),
        isNull(episodes.deletedAt),
      ),
    )
    .returning();
  return row ?? null;
}

export async function listEpisodesByOrg(organizationId: number, page: number, limit: number) {
  const offset = (page - 1) * limit;
  return await db
    .select()
    .from(episodes)
    .where(and(eq(episodes.organizationId, organizationId), isNull(episodes.deletedAt)))
    .orderBy(desc(episodes.publishedAt), desc(episodes.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function countEpisodesByOrg(organizationId: number) {
  const [result] = await db
    .select({ count: count() })
    .from(episodes)
    .where(and(eq(episodes.organizationId, organizationId), isNull(episodes.deletedAt)));
  return result?.count ?? 0;
}
