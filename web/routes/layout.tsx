import { Outlet } from "react-router";
import { authenticatedUserContext, requireAuth, setAuthCookies } from "~/lib/session.server";
import type { Route } from "./+types/layout";

export const middleware: Route.MiddlewareFunction[] = [
  async ({ request, context }, next) => {
    const { user, newAccessToken, newRefreshToken } = await requireAuth(request);
    context.set(authenticatedUserContext, user);

    const response = await next();
    if (newAccessToken && newRefreshToken) {
      const cookies = await setAuthCookies(newAccessToken, newRefreshToken);
      cookies.forEach((cookie) => response.headers.append("Set-Cookie", cookie));
    }
    return response;
  },
];

export default function AuthenticatedLayout() {
  return <Outlet />;
}
