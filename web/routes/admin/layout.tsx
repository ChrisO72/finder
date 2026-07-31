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
import { requireAdmin } from "~/lib/session.server";
import type { Route } from "./+types/layout";

export function loader({ context }: Route.LoaderArgs) {
  return requireAdmin(context);
}

export default function AdminLayout({ loaderData }: Route.ComponentProps) {
  const { pathname } = useLocation();
  const { user } = loaderData;

  return (
    <SidebarLayout
      navbar={
        <Navbar>
          <span className="text-sm font-semibold text-zinc-950 dark:text-white">Finder</span>
        </Navbar>
      }
      sidebar={
        <Sidebar>
          <SidebarHeader>
            <div className="px-2 py-1 text-lg font-semibold text-zinc-950 dark:text-white">
              Finder
            </div>
          </SidebarHeader>
          <SidebarBody>
            <SidebarSection>
              <SidebarItem href="/admin" current={pathname === "/admin"}>
                <SidebarLabel>Search</SidebarLabel>
              </SidebarItem>
              <SidebarItem href="/admin/episodes" current={pathname.startsWith("/admin/episodes")}>
                <SidebarLabel>Episodes</SidebarLabel>
              </SidebarItem>
              <SidebarItem href="/admin/users" current={pathname.startsWith("/admin/users")}>
                <SidebarLabel>Users</SidebarLabel>
              </SidebarItem>
              <SidebarItem href="/admin/settings" current={pathname.startsWith("/admin/settings")}>
                <SidebarLabel>Settings</SidebarLabel>
              </SidebarItem>
            </SidebarSection>
          </SidebarBody>
          <SidebarFooter>
            <ThemeToggle />
            <div className="px-2 py-1">
              <p className="text-sm font-medium text-zinc-900 dark:text-white">
                {user.firstName || "Administrator"}
              </p>
              <p className="truncate text-xs text-zinc-500">{user.email}</p>
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
