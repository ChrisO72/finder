import { redirect } from "react-router";
import { verifyAccessToken } from "./auth.server";
import { refreshAccessToken } from "../../db/repositories/auth";

export function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;

  for (const cookie of cookieHeader.split("; ")) {
    const [name, ...rest] = cookie.split("=");
    if (name && rest.length > 0) {
      cookies[name] = rest.join("=");
    }
  }
  return cookies;
}

export async function requireAuth(request: Request) {
  const cookieHeader = request.headers.get("Cookie") || "";
  const cookies = parseCookies(cookieHeader);

  const accessToken = cookies.accessToken;
  const refreshToken = cookies.refreshToken;

  // Try access token first
  if (accessToken) {
    const payload = verifyAccessToken(accessToken);
    if (payload) {
      return {
        userId: payload.userId,
        email: payload.email,
        newAccessToken: null,
        newRefreshToken: null,
      };
    }
  }

  // Try refresh token
  if (refreshToken) {
    const result = await refreshAccessToken(refreshToken);
    if (result) {
      return {
        userId: result.user.id,
        email: result.user.email,
        newAccessToken: result.accessToken,
        newRefreshToken: result.refreshToken,
      };
    }
  }

  throw redirect("/login");
}

export function setAuthCookies(accessToken: string, refreshToken: string): string[] {
  return [
    `accessToken=${accessToken}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${15 * 60}`,
    `refreshToken=${refreshToken}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`,
  ];
}

export function clearAuthCookies(): string[] {
  return [
    "accessToken=; HttpOnly; Path=/; Max-Age=0",
    "refreshToken=; HttpOnly; Path=/; Max-Age=0",
  ];
}
