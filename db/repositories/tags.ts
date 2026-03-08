import { and, count, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "../db";
import { tags, videoTags, videos } from "../schema";

export async function upsertTag(
  name: string,
  slug: string,
  organizationId: number,
) {
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

export async function setVideoTags(videoId: number, tagIds: number[]) {
  await db.delete(videoTags).where(eq(videoTags.videoId, videoId));
  if (tagIds.length === 0) return;
  await db
    .insert(videoTags)
    .values(tagIds.map((tagId) => ({ videoId, tagId })));
}

export async function getTagsForVideo(videoId: number) {
  return await db
    .select({ id: tags.id, name: tags.name, slug: tags.slug })
    .from(tags)
    .innerJoin(videoTags, eq(videoTags.tagId, tags.id))
    .where(eq(videoTags.videoId, videoId));
}

export type TagWithCount = {
  id: number;
  name: string;
  slug: string;
  videoCount: number;
};

export async function getTagsByOrganization(
  organizationId: number,
): Promise<TagWithCount[]> {
  const rows = await db
    .select({
      id: tags.id,
      name: tags.name,
      slug: tags.slug,
      videoCount: count(videoTags.videoId),
    })
    .from(tags)
    .innerJoin(videoTags, eq(videoTags.tagId, tags.id))
    .innerJoin(videos, eq(videoTags.videoId, videos.id))
    .where(
      and(
        eq(tags.organizationId, organizationId),
        isNull(videos.deletedAt),
        eq(videos.status, "ready"),
      ),
    )
    .groupBy(tags.id, tags.name, tags.slug)
    .orderBy(sql`count(${videoTags.videoId}) DESC`);

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    videoCount: r.videoCount,
  }));
}

export async function getVideosByTag(tagSlug: string, organizationId: number) {
  return await db
    .select({
      id: videos.id,
      title: videos.title,
      channelTitle: videos.channelTitle,
      thumbnailUrl: videos.thumbnailUrl,
      durationSeconds: videos.durationSeconds,
      youtubeVideoId: videos.youtubeVideoId,
    })
    .from(videos)
    .innerJoin(videoTags, eq(videoTags.videoId, videos.id))
    .innerJoin(tags, eq(videoTags.tagId, tags.id))
    .where(
      and(
        eq(tags.slug, tagSlug),
        eq(tags.organizationId, organizationId),
        isNull(videos.deletedAt),
        eq(videos.status, "ready"),
      ),
    );
}

export async function getVideoIdsForTag(
  tagSlug: string,
  organizationId: number,
): Promise<number[]> {
  const rows = await db
    .select({ videoId: videoTags.videoId })
    .from(videoTags)
    .innerJoin(tags, eq(videoTags.tagId, tags.id))
    .innerJoin(videos, eq(videoTags.videoId, videos.id))
    .where(
      and(
        eq(tags.slug, tagSlug),
        eq(tags.organizationId, organizationId),
        isNull(videos.deletedAt),
      ),
    );

  return rows.map((r) => r.videoId);
}
