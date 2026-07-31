import { redirect } from "react-router";
import { deleteRefreshTokenByHash } from "~/db/repositories/refreshTokens";
import { hashRefreshToken } from "~/lib/auth/tokens.server";
import { clearAuthCookies, readRefreshTokenCookie } from "~/lib/session.server";
import type { Route } from "./+types/logout";

export async function action({ request }: Route.ActionArgs) {
  const refreshToken = await readRefreshTokenCookie(request);
  if (refreshToken) {
    await deleteRefreshTokenByHash(hashRefreshToken(refreshToken));
  }

  const clearCookies = await clearAuthCookies();
  return redirect("/login", {
    headers: clearCookies.map((cookie) => ["Set-Cookie", cookie] as [string, string]),
  });
}

export async function loader() {
  return redirect("/login");
}

export default function Logout() {
  return null;
}
