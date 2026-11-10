import path from "node:path";

import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import sirv from "sirv";
import { defineConfig, type Plugin } from "vite";

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

export default defineConfig({
  plugins: [localData(), tailwindcss(), reactRouter()],
  resolve: {
    tsconfigPaths: true,
  },
});
