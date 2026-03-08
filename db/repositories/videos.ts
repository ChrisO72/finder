import { and, count, desc, eq, isNull } from "drizzle-orm";
import { db } from "../db";
import { type InsertVideo, videos } from "../schema";

export async function createVideo(video: InsertVideo) {
  const [row] = await db.insert(videos).values(video).returning();
  return row;
}

export async function getVideoById(id: number) {
  const [row] = await db
    .select()
    .from(videos)
    .where(and(eq(videos.id, id), isNull(videos.deletedAt)))
    .limit(1);
  return row ?? null;
}

export async function getVideoByIdForOrg(id: number, organizationId: number) {
  const [row] = await db
    .select()
    .from(videos)
    .where(
      and(
        eq(videos.id, id),
        eq(videos.organizationId, organizationId),
        isNull(videos.deletedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function updateVideo(id: number, data: Partial<InsertVideo>) {
  const [row] = await db
    .update(videos)
    .set(data)
    .where(eq(videos.id, id))
    .returning();
  return row ?? null;
}

export async function softDeleteVideo(id: number, organizationId: number) {
  const [row] = await db
    .update(videos)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(videos.id, id),
        eq(videos.organizationId, organizationId),
        isNull(videos.deletedAt),
      ),
    )
    .returning();
  return row ?? null;
}

export async function listVideosByOrg(
  organizationId: number,
  page: number,
  limit: number,
) {
  const offset = (page - 1) * limit;
  return await db
    .select()
    .from(videos)
    .where(
      and(eq(videos.organizationId, organizationId), isNull(videos.deletedAt)),
    )
    .orderBy(desc(videos.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function countVideosByOrg(organizationId: number) {
  const [result] = await db
    .select({ count: count() })
    .from(videos)
    .where(
      and(eq(videos.organizationId, organizationId), isNull(videos.deletedAt)),
    );
  return result?.count ?? 0;
}

export async function recentVideosByOrg(
  organizationId: number,
  limit: number = 8,
) {
  return await db
    .select()
    .from(videos)
    .where(
      and(
        eq(videos.organizationId, organizationId),
        isNull(videos.deletedAt),
        eq(videos.status, "ready"),
      ),
    )
    .orderBy(desc(videos.createdAt))
    .limit(limit);
}
