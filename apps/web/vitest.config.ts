import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// Separate from vite.config.ts: the React Router plugin does not run under Vitest.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    // The scope-index plugin (vite.config.ts) is not loaded here; tests get an empty index.
    alias: {
      "virtual:tt-scope-index": fileURLToPath(new URL("./src/data/scopeIndex.empty.ts", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}", "app/**/*.test.{ts,tsx}"],
    passWithNoTests: false,
  },
});
