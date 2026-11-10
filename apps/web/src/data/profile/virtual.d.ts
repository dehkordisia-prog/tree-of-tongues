// Generated at build time by the profiles plugin in vite.config.ts (app/server/profiles.server.ts).
declare module "virtual:tt-profiles" {
  import type { Profile } from "@/data/profile/types";
  export const loaders: Record<string, () => Promise<{ default: Profile }>>;
}
