import { createContext, createCookie, redirect, type RouterContextProvider } from "react-router";
import { getUserById, type SafeUser } from "~/db/repositories/users";
import { env } from "~/env.server";
import {
  ACCESS_TOKEN_MAX_AGE,
  REFRESH_TOKEN_MAX_AGE,
  refreshAccessToken,
  verifyAccessToken,
} from "./auth/tokens.server";

const isProduction = env.NODE_ENV === "production";

export const authenticatedUserContext = createContext<SafeUser>();

export const accessTokenCookie = createCookie("accessToken", {
  httpOnly: true,
  sameSite: "lax",
  secure: isProduction,
  path: "/",
  maxAge: ACCESS_TOKEN_MAX_AGE,
});

export const refreshTokenCookie = createCookie("refreshToken", {
  httpOnly: true,
  sameSite: "lax",
  secure: isProduction,
  path: "/",
  maxAge: REFRESH_TOKEN_MAX_AGE,
});

async function readAuthCookies(request: Request) {
  const cookieHeader = request.headers.get("Cookie");
  const [accessToken, refreshToken] = await Promise.all([
    accessTokenCookie.parse(cookieHeader) as Promise<string | null>,
    refreshTokenCookie.parse(cookieHeader) as Promise<string | null>,
  ]);
  return { accessToken, refreshToken };
}

export async function readAccessTokenCookie(request: Request): Promise<string | null> {
  return (await accessTokenCookie.parse(request.headers.get("Cookie"))) as string | null;
}

export async function readRefreshTokenCookie(request: Request): Promise<string | null> {
  return (await refreshTokenCookie.parse(request.headers.get("Cookie"))) as string | null;
}

export async function requireAuth(request: Request) {
  const { accessToken, refreshToken } = await readAuthCookies(request);

  let userId: number | null = null;
  let newAccessToken: string | null = null;
  let newRefreshToken: string | null = null;

  if (accessToken) {
    const payload = verifyAccessToken(accessToken);
    if (payload) userId = payload.userId;
  }

  if (userId === null && refreshToken) {
    const result = await refreshAccessToken(refreshToken);
    if (result) {
      userId = result.user.id;
      newAccessToken = result.accessToken;
      newRefreshToken = result.refreshToken;
    }
  }

  if (userId === null) {
    throw redirect("/login");
  }

  const user = await getUserById(userId);
  if (!user) {
    const cookies = await clearAuthCookies();
    throw redirect("/login", {
      headers: cookies.map((cookie) => ["Set-Cookie", cookie] as [string, string]),
    });
  }

  return { user, newAccessToken, newRefreshToken };
}

export function getAuthenticatedUser(context: Readonly<RouterContextProvider>) {
  return context.get(authenticatedUserContext);
}

export function requireAdmin(context: Readonly<RouterContextProvider>) {
  const user = getAuthenticatedUser(context);
  if (user.role !== "admin") {
    throw redirect("/");
  }
  return { user };
}

export async function setAuthCookies(accessToken: string, refreshToken: string): Promise<string[]> {
  return Promise.all([
    accessTokenCookie.serialize(accessToken),
    refreshTokenCookie.serialize(refreshToken),
  ]);
}

export async function clearAuthCookies(): Promise<string[]> {
  return Promise.all([
    accessTokenCookie.serialize("", { maxAge: 0 }),
    refreshTokenCookie.serialize("", { maxAge: 0 }),
  ]);
}
