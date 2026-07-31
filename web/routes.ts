import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("login", "routes/auth/login.tsx"),
  route("signup", "routes/auth/signup.tsx"),
  route("logout", "routes/auth/logout.tsx"),
  route("check-email", "routes/auth/check-email.tsx"),
  route("confirm-email", "routes/auth/confirm-email.tsx"),

  layout("routes/layout.tsx", [
    layout("routes/admin/layout.tsx", [
      route("admin", "routes/admin/search.tsx"),
      route("admin/episodes", "routes/admin/episodes.tsx"),
      route("admin/episodes/:id", "routes/admin/episode.tsx"),
      route("admin/settings", "routes/admin/index.tsx"),
      route("admin/users", "routes/admin/users.tsx"),
    ]),
  ]),
] satisfies RouteConfig;
