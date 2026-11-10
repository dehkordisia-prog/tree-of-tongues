import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import sirv from "sirv";
import { defineConfig, type Plugin } from "vite";

import {
  BIB_FILE,
  checkAllProfiles,
  profileFile,
  profileGlottocodes,
  readProfile,
} from "./app/server/profiles.server.ts";
import { buildScopeIndex, DATA_DIR } from "./app/server/scopeIndex.server.ts";

// Pipeline output (data/build, about 90 MB) is served in place at /data/ during development,
// never copied into the app build. Production reads the same files from object storage
// (docs/ARCHITECTURE.md). scripts/serve.mjs does the same for the built app.
function localData(): Plugin {
  const dir = DATA_DIR;
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

// virtual:tt-profiles: the profile prose (content/languages/*.md with content/sources.bib), parsed
// here at build time so no Markdown or BibTeX code ships. The index lists the glottocodes with a
// profile and imports each one lazily (virtual:tt-profile/{glottocode}, one chunk per profile).
// `vite build` checks every profile first: an unknown citation key fails the build.
function profiles(): Plugin {
  const index = "virtual:tt-profiles";
  const one = "virtual:tt-profile/";
  const NUL = "\0";
  let command: "build" | "serve" = "serve";
  return {
    name: "tree-of-tongues:profiles",
    configResolved(c) {
      command = c.command;
    },
    buildStart() {
      if (command === "build") checkAllProfiles();
    },
    resolveId: (source) => (source === index || source.startsWith(one) ? NUL + source : undefined),
    load(id) {
      if (id === NUL + index) {
        const entries = profileGlottocodes().map(
          (g) => `  ${JSON.stringify(g)}: () => import(${JSON.stringify(one + g)}),`,
        );
        return ["export const loaders = {", ...entries, "};", ""].join("\n");
      }
      if (id.startsWith(NUL + one)) {
        const g = id.slice(NUL.length + one.length);
        this.addWatchFile(profileFile(g));
        this.addWatchFile(BIB_FILE);
        return `export default ${JSON.stringify(readProfile(g))};`;
      }
      return undefined;
    },
  };
}

export default defineConfig({
  plugins: [localData(), scopeIndex(), profiles(), tailwindcss(), reactRouter()],
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
