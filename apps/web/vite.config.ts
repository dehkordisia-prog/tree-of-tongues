import path from "node:path";

import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import sirv from "sirv";
import { defineConfig, type Plugin } from "vite";

import { buildScopeIndex } from "./app/server/scopeIndex.server.ts";

// Pipeline output (data/build, about 90 MB) is served in place at /data/ during development,
// never copied into the app build. Production reads the same files from object storage
// (docs/ARCHITECTURE.md). scripts/serve.mjs does the same for the built app.
function localData(): Plugin {
  const dir = path.resolve(import.meta.dirname, "../../data/build");
  return {
    name: "tree-of-tongues:local-data",
    configureServer(server) {
      server.middlewares.use("/data", sirv(dir, { dev: true, etag: true }));
    },
  };
}

// virtual:tt-scope-index: the scope list digested with the scope bundles (src/data/scopeIndex.ts).
// Generated once per dev server or build, so it reflects data/build at that moment. It is imported
// lazily (route loaders and search), so it is not part of the app-shell chunk.
function scopeIndex(): Plugin {
  const id = "virtual:tt-scope-index";
  const resolved = "\0" + id;
  return {
    name: "tree-of-tongues:scope-index",
    resolveId: (source) => (source === id ? resolved : undefined),
    load(source) {
      if (source !== resolved) return undefined;
      return `export default ${JSON.stringify(buildScopeIndex())};`;
    },
  };
}

export default defineConfig({
  plugins: [localData(), scopeIndex(), tailwindcss(), reactRouter()],
  // Canvas libraries load lazily, so Vite would discover them late and reload ("504 Outdated
  // Optimize Dep") on a cold cache. Pre-bundling them up front avoids that.
  optimizeDeps: {
    include: [
      "pixi.js",
      "@deck.gl/core",
      "@deck.gl/layers",
      "@deck.gl/mapbox",
      "maplibre-gl",
      "d3-hierarchy",
      // The shell's own dependencies, so a cold dev server does not reload on the first visit.
      "radix-ui",
      "zustand",
      "zustand/vanilla",
    ],
  },
  resolve: {
    tsconfigPaths: true,
  },
});
