import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  // The shell owns one canvas; entity routes only change what is selected (docs/specs/app-shell.md 2.1).
  layout("routes/shell.tsx", [
    index("routes/world.tsx"),
    route("language/:glottocode", "routes/language.tsx"),
    route("family/:glottocode", "routes/family.tsx"),
  ]),
  route("design", "routes/design.tsx"),
  // Phase 0 spikes, kept for the D-006 benchmark until the production lenses pass the Phase 1 gate.
  route("spike/tree", "routes/spike.tree.tsx"),
  route("spike/map", "routes/spike.map.tsx"),
] satisfies RouteConfig;
