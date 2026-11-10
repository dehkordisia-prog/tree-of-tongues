import type { Config } from "@react-router/dev/config";

// SPA with build-time prerender (docs/ARCHITECTURE.md): no server at runtime.
// Every static route is prerendered to HTML; canvases start on the client.
export default {
  ssr: false,
  prerender: true,
} satisfies Config;
