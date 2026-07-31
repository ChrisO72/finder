import { useLocation } from "react-router";
import { Navbar, NavbarItem, NavbarSection } from "~/components/ui-kit/navbar";

const tabs = [
  { name: "Site settings", href: "/admin" },
  { name: "Users", href: "/admin/users" },
] as const;

export function AdminNav() {
  const { pathname } = useLocation();

  return (
    <Navbar className="mb-6 border-b border-zinc-950/10 dark:border-white/10">
      <NavbarSection>
        {tabs.map((tab) => {
          const current =
            tab.href === "/admin" ? pathname === "/admin" : pathname.startsWith(tab.href);
          return (
            <NavbarItem key={tab.href} href={tab.href} current={current}>
              {tab.name}
            </NavbarItem>
          );
        })}
      </NavbarSection>
    </Navbar>
  );
}
