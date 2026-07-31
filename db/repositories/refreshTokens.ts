import { and, eq, gt } from "drizzle-orm";
import { db } from "../db";
import { type InsertRefreshToken, refreshTokens } from "../schema/auth";

export async function insertRefreshToken(data: InsertRefreshToken) {
  const [row] = await db.insert(refreshTokens).values(data).returning();
  return row;
}

export async function findRefreshTokenByHash(tokenHash: string) {
  const [row] = await db
    .select()
    .from(refreshTokens)
    .where(and(eq(refreshTokens.tokenHash, tokenHash), gt(refreshTokens.expiresAt, new Date())))
    .limit(1);
  return row ?? null;
}

export async function deleteRefreshTokenByHash(tokenHash: string) {
  await db.delete(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash));
}

export async function rotateRefreshToken(
  oldTokenHash: string,
  replacement: Omit<InsertRefreshToken, "userId">,
) {
  return db.transaction(async (tx) => {
    const [consumed] = await tx
      .delete(refreshTokens)
      .where(
        and(eq(refreshTokens.tokenHash, oldTokenHash), gt(refreshTokens.expiresAt, new Date())),
      )
      .returning({ userId: refreshTokens.userId });

    if (!consumed) return false;

    await tx.insert(refreshTokens).values({
      ...replacement,
      userId: consumed.userId,
    });
    return true;
  });
}
