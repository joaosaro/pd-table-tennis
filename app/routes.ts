import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  // Public routes
  index("routes/home.tsx"),
  route("standings", "routes/standings.tsx"),
  route("results", "routes/results.tsx"),
  route("players", "routes/players.tsx"),
  route("player/:id", "routes/player.$id.tsx"),
  route("match/:id", "routes/match.$id.tsx"),
  route("bracket", "routes/bracket.tsx"),

  // Auth routes
  route("login", "routes/auth/login.tsx"),
  route("auth/callback", "routes/auth/callback.tsx"),
  route("logout", "routes/auth/logout.tsx"),

  // Editor routes
  route("editor/record/:matchId", "routes/editor/record.$matchId.tsx"),

  // Admin routes
  route("admin", "routes/admin/index.tsx"),
  route("admin/players", "routes/admin/players.tsx"),
  route("admin/players/new", "routes/admin/players.new.tsx"),
  route("admin/players/:id/edit", "routes/admin/players.$id.edit.tsx"),
  route("admin/tiers", "routes/admin/tiers.tsx"),
  route("admin/matches", "routes/admin/matches.tsx"),
  route("admin/generate", "routes/admin/generate.tsx"),
  route("admin/settings", "routes/admin/settings.tsx"),
  route("admin/users", "routes/admin/users.tsx"),
] satisfies RouteConfig;
