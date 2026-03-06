import { eq, and, gt } from "drizzle-orm";
import { db } from "../db";
import { users, refreshTokens, organizations } from "../schema";
import {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
  getRefreshTokenExpiry,
} from "../../web/lib/auth.server";

export async function getUserByEmail(email: string) {
  const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
  return user ?? null;
}

export async function createUserWithPassword(email: string, password: string, firstname?: string) {
  const passwordHash = await hashPassword(password);

  // Create a personal organization for the user
  const [org] = await db
    .insert(organizations)
    .values({
      name: `${firstname || email}'s Organization`,
    })
    .returning();

  const [user] = await db
    .insert(users)
    .values({
      email: email.toLowerCase(),
      passwordHash,
      firstName: firstname || null,
      organizationId: org.id,
    })
    .returning();

  return user;
}

export async function validateLogin(email: string, password: string) {
  const user = await getUserByEmail(email);
  if (!user || !user.passwordHash) return null;

  const valid = await verifyPassword(password, user.passwordHash);
  return valid ? user : null;
}

export async function createTokens(userId: number, email: string) {
  const accessToken = generateAccessToken(userId, email);
  const refreshToken = generateRefreshToken(userId);

  await db.insert(refreshTokens).values({
    userId,
    token: refreshToken,
    expiresAt: getRefreshTokenExpiry(),
  });

  return { accessToken, refreshToken };
}

export async function refreshAccessToken(token: string) {
  return await db.transaction(async (tx) => {
    const [storedToken] = await tx
      .select()
      .from(refreshTokens)
      .where(and(eq(refreshTokens.token, token), gt(refreshTokens.expiresAt, new Date())))
      .limit(1);

    if (!storedToken) return null;

    const [user] = await tx.select().from(users).where(eq(users.id, storedToken.userId)).limit(1);
    if (!user) return null;

    // Delete old refresh token
    await tx.delete(refreshTokens).where(eq(refreshTokens.token, token));

    // Create new refresh token (rotation)
    const newRefreshToken = generateRefreshToken(user.id);
    await tx.insert(refreshTokens).values({
      userId: user.id,
      token: newRefreshToken,
      expiresAt: getRefreshTokenExpiry(),
    });

    return {
      accessToken: generateAccessToken(user.id, user.email),
      refreshToken: newRefreshToken,
      user,
    };
  });
}

export async function deleteRefreshToken(token: string) {
  await db.delete(refreshTokens).where(eq(refreshTokens.token, token));
}
