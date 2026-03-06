import { redirect } from "react-router";
import { clearAuthCookies, parseCookies } from "../../lib/session.server";
import { deleteRefreshToken } from "../../../db/repositories/auth";
import type { Route } from "./+types/logout";

export async function loader({ request }: Route.LoaderArgs) {
  const cookieHeader = request.headers.get("Cookie") || "";
  const cookies = parseCookies(cookieHeader);

  if (cookies.refreshToken) {
    await deleteRefreshToken(cookies.refreshToken);
  }

  const clearCookies = clearAuthCookies();
  return redirect("/login", {
    headers: clearCookies.map((cookie) => ["Set-Cookie", cookie] as [string, string]),
  });
}

export default function Logout() {
  return null;
}
