import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  // Auth routes (unprotected)
  route("login", "routes/auth/login.tsx"),
  route("signup", "routes/auth/signup.tsx"),
  route("logout", "routes/auth/logout.tsx"),

  // Protected routes
  layout("routes/layout.tsx", [
    index("routes/home.tsx"),
    route("videos", "routes/videos/index.tsx"),
    route("videos/:id", "routes/videos/video/video.tsx"),
  ]),
] satisfies RouteConfig;
