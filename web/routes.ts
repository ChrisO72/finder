import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  // Auth routes (unprotected)
  route("login", "routes/auth/login.tsx"),
  route("signup", "routes/auth/signup.tsx"),
  route("logout", "routes/auth/logout.tsx"),

  // Protected routes
  layout("routes/layout.tsx", [
    index("routes/home.tsx"),
    route("do-things", "routes/do-things/index.tsx"),
    route("manage-items", "routes/manage-items/index.tsx"),
    route("manage-items/:item", "routes/manage-items/item.tsx"),
  ]),
] satisfies RouteConfig;
