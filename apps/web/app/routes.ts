import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  // Phase 0 workbenches. Each is replaced by its owner agent.
  route("design", "routes/design.tsx"),
  route("spike/tree", "routes/spike.tree.tsx"),
  route("spike/map", "routes/spike.map.tsx"),
] satisfies RouteConfig;
