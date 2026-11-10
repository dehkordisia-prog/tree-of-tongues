import type { Config } from "@react-router/dev/config";

import { scopePrerenderPaths } from "./app/server/scopeIndex.server.ts";

// SPA with build-time prerender (docs/ARCHITECTURE.md): no server at runtime.
// Prerendered: every static route, plus the Phase 1 scope languages and their families
// (content/scope/phase-1-languages.yaml). Any other Glottocode is served by the SPA fallback
// (build/client/__spa-fallback.html) and loads its bundle through the route's clientLoader.
export default {
  ssr: false,
  async prerender({ getStaticPaths }) {
    return [...getStaticPaths(), ...scopePrerenderPaths().map((t) => t.path)];
  },
} satisfies Config;
