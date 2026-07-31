import crypto from "crypto";
import jwt from "jsonwebtoken";
import {
  findRefreshTokenByHash,
  insertRefreshToken,
  rotateRefreshToken,
} from "~/db/repositories/refreshTokens";
import { getUserById } from "~/db/repositories/users";
import { env } from "~/env.server";

const JWT_SECRET = env.JWT_SECRET;
const REFRESH_SECRET = env.REFRESH_SECRET;

export const ACCESS_TOKEN_MAX_AGE = 15 * 60;
export const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60;

export function generateAccessToken(userId: number, email: string): string {
  return jwt.sign({ userId, email }, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_MAX_AGE,
  });
}

export function generateRefreshToken(userId: number): string {
  const jti = crypto.randomUUID();
  return jwt.sign({ userId, jti }, REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_MAX_AGE,
  });
}

export function verifyAccessToken(token: string): { userId: number; email: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: number; email: string };
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): { userId: number } | null {
  try {
    return jwt.verify(token, REFRESH_SECRET) as { userId: number };
  } catch {
    return null;
  }
}

export function getRefreshTokenExpiry(): Date {
  return new Date(Date.now() + REFRESH_TOKEN_MAX_AGE * 1000);
}

export function hashRefreshToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createTokens(userId: number, email: string) {
  const accessToken = generateAccessToken(userId, email);
  const refreshToken = generateRefreshToken(userId);

  await insertRefreshToken({
    userId,
    tokenHash: hashRefreshToken(refreshToken),
    expiresAt: getRefreshTokenExpiry(),
  });

  return { accessToken, refreshToken };
}

export async function refreshAccessToken(token: string) {
  const tokenHash = hashRefreshToken(token);
  const stored = await findRefreshTokenByHash(tokenHash);
  if (!stored) return null;

  const user = await getUserById(stored.userId);
  if (!user) return null;

  const accessToken = generateAccessToken(user.id, user.email);
  const refreshToken = generateRefreshToken(user.id);
  const rotated = await rotateRefreshToken(tokenHash, {
    tokenHash: hashRefreshToken(refreshToken),
    expiresAt: getRefreshTokenExpiry(),
  });
  if (!rotated) return null;

  return { accessToken, refreshToken, user };
}
