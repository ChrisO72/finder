import { and, count, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "../db";
import { episodes } from "../schema/episodes";
import { episodeTags, tags } from "../schema/tags";

export async function upsertTag(name: string, slug: string, organizationId: number) {
  const [existing] = await db
    .select()
    .from(tags)
    .where(and(eq(tags.slug, slug), eq(tags.organizationId, organizationId)))
    .limit(1);

  if (existing) return existing;

  const [row] = await db
    .insert(tags)
    .values({ name, slug, organizationId })
    .onConflictDoNothing()
    .returning();

  if (row) return row;

  const [fallback] = await db
    .select()
    .from(tags)
    .where(and(eq(tags.slug, slug), eq(tags.organizationId, organizationId)))
    .limit(1);

  return fallback;
}

export async function setEpisodeTags(episodeId: number, tagIds: number[]) {
  await db.delete(episodeTags).where(eq(episodeTags.episodeId, episodeId));
  if (tagIds.length === 0) return;
  await db.insert(episodeTags).values(tagIds.map((tagId) => ({ episodeId, tagId })));
}

export async function getTagsForEpisode(episodeId: number) {
  return await db
    .select({ id: tags.id, name: tags.name, slug: tags.slug })
    .from(tags)
    .innerJoin(episodeTags, eq(episodeTags.tagId, tags.id))
    .where(eq(episodeTags.episodeId, episodeId));
}

export type TagWithCount = {
  id: number;
  name: string;
  slug: string;
  episodeCount: number;
};

export async function getTagsByOrganization(organizationId: number): Promise<TagWithCount[]> {
  const rows = await db
    .select({
      id: tags.id,
      name: tags.name,
      slug: tags.slug,
      episodeCount: count(episodeTags.episodeId),
    })
    .from(tags)
    .innerJoin(episodeTags, eq(episodeTags.tagId, tags.id))
    .innerJoin(episodes, eq(episodeTags.episodeId, episodes.id))
    .where(
      and(
        eq(tags.organizationId, organizationId),
        isNull(episodes.deletedAt),
        eq(episodes.status, "ready"),
      ),
    )
    .groupBy(tags.id, tags.name, tags.slug)
    .orderBy(sql`count(${episodeTags.episodeId}) DESC`);

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    episodeCount: r.episodeCount,
  }));
}

export async function getEpisodesByTag(tagSlug: string, organizationId: number) {
  return await db
    .select({
      id: episodes.id,
      title: episodes.title,
      podcastTitle: episodes.podcastTitle,
      artworkUrl: episodes.artworkUrl,
      durationSeconds: episodes.durationSeconds,
    })
    .from(episodes)
    .innerJoin(episodeTags, eq(episodeTags.episodeId, episodes.id))
    .innerJoin(tags, eq(episodeTags.tagId, tags.id))
    .where(
      and(
        eq(tags.slug, tagSlug),
        eq(tags.organizationId, organizationId),
        isNull(episodes.deletedAt),
        eq(episodes.status, "ready"),
      ),
    );
}

export async function getTagsForEpisodeIds(
  episodeIds: number[],
): Promise<Record<number, { id: number; name: string; slug: string }[]>> {
  if (episodeIds.length === 0) return {};
  const rows = await db
    .select({
      episodeId: episodeTags.episodeId,
      id: tags.id,
      name: tags.name,
      slug: tags.slug,
    })
    .from(episodeTags)
    .innerJoin(tags, eq(episodeTags.tagId, tags.id))
    .where(inArray(episodeTags.episodeId, episodeIds));

  const map: Record<number, { id: number; name: string; slug: string }[]> = {};
  for (const row of rows) {
    (map[row.episodeId] ??= []).push({
      id: row.id,
      name: row.name,
      slug: row.slug,
    });
  }
  return map;
}

export async function getEpisodeIdsForTag(
  tagSlug: string,
  organizationId: number,
): Promise<number[]> {
  const rows = await db
    .select({ episodeId: episodeTags.episodeId })
    .from(episodeTags)
    .innerJoin(tags, eq(episodeTags.tagId, tags.id))
    .innerJoin(episodes, eq(episodeTags.episodeId, episodes.id))
    .where(
      and(
        eq(tags.slug, tagSlug),
        eq(tags.organizationId, organizationId),
        isNull(episodes.deletedAt),
      ),
    );

  return rows.map((r) => r.episodeId);
}
