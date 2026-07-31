import { Form, Outlet, useLocation } from "react-router";
import { ThemeToggle } from "~/components/theme-toggle";
import { Navbar } from "~/components/ui-kit/navbar";
import {
  Sidebar,
  SidebarBody,
  SidebarFooter,
  SidebarHeader,
  SidebarItem,
  SidebarLabel,
  SidebarSection,
} from "~/components/ui-kit/sidebar";
import { SidebarLayout } from "~/components/ui-kit/sidebar-layout";
import {
  authenticatedUserContext,
  getAuthenticatedUser,
  requireAuth,
  setAuthCookies,
} from "~/lib/session.server";
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

export function loader({ context }: Route.LoaderArgs) {
  return { user: getAuthenticatedUser(context) };
}

export default function Layout({ loaderData }: Route.ComponentProps) {
  const { pathname } = useLocation();
  const { user } = loaderData;

  return (
    <SidebarLayout
      navbar={<Navbar />}
      sidebar={
        <Sidebar>
          <SidebarHeader>
            <div className="px-2 py-1">
              <h2 className="text-lg font-semibold text-zinc-950 dark:text-white">Finder</h2>
            </div>
          </SidebarHeader>
          <SidebarBody>
            <SidebarSection>
              <SidebarItem href="/" current={pathname === "/"}>
                <SidebarLabel>Search</SidebarLabel>
              </SidebarItem>
              <SidebarItem href="/videos" current={pathname.startsWith("/videos")}>
                <SidebarLabel>Videos</SidebarLabel>
              </SidebarItem>
              <SidebarItem href="/settings" current={pathname.startsWith("/settings")}>
                <SidebarLabel>Settings</SidebarLabel>
              </SidebarItem>
              {user.role === "admin" && (
                <SidebarItem href="/admin" current={pathname.startsWith("/admin")}>
                  <SidebarLabel>Admin</SidebarLabel>
                </SidebarItem>
              )}
            </SidebarSection>
          </SidebarBody>
          <SidebarFooter>
            <ThemeToggle />
            <div className="flex items-center justify-between p-2">
              <div>
                <div>{user.firstName}</div>
                <div className="text-xs opacity-60">{user.email}</div>
              </div>
            </div>
            <Form method="post" action="/logout">
              <SidebarItem type="submit">
                <SidebarLabel>Sign out</SidebarLabel>
              </SidebarItem>
            </Form>
          </SidebarFooter>
        </Sidebar>
      }
    >
      <Outlet />
    </SidebarLayout>
  );
}
