import { eq } from "drizzle-orm";
import { db } from "../db";
import { type InsertWindow, windows } from "../schema";

export async function bulkInsertWindows(rows: InsertWindow[]) {
  if (rows.length === 0) return [];
  return await db.insert(windows).values(rows).returning();
}

export async function deleteWindowsByVideoId(videoId: number) {
  return await db.delete(windows).where(eq(windows.videoId, videoId));
}
