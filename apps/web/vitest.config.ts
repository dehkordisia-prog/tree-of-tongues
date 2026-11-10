import { defineConfig } from "vitest/config";

// Separate from vite.config.ts: the React Router plugin does not run under Vitest.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}", "app/**/*.test.{ts,tsx}"],
    passWithNoTests: false,
  },
});
