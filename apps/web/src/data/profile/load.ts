// Loads a profile built at build time (vite.config.ts, profiles plugin). The index is tiny; each
// profile is its own chunk, fetched only when its language is opened. Vitest maps the virtual
// module to profiles.empty.ts.

import type { Profile } from "./types";

export async function loadProfile(glottocode: string): Promise<Profile | null> {
  const { loaders } = await import("virtual:tt-profiles");
  const load = (loaders as Record<string, (() => Promise<{ default: Profile }>) | undefined>)[glottocode];
  if (!load) return null;
  return (await load()).default;
}
