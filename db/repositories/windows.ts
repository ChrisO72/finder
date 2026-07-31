import { eq } from "drizzle-orm";
import { db } from "../db";
import { type InsertWindow, windows } from "../schema/windows";

export async function bulkInsertWindows(rows: InsertWindow[]) {
  if (rows.length === 0) return [];
  return await db.insert(windows).values(rows).returning();
}

export async function deleteWindowsByEpisodeId(episodeId: number) {
  return await db.delete(windows).where(eq(windows.episodeId, episodeId));
}
