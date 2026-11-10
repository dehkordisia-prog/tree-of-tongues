// Stand-in for virtual:tt-profiles under Vitest (vitest.config.ts), where the Vite plugin does not run.
import type { Profile } from "./types";

export const loaders: Record<string, () => Promise<{ default: Profile }>> = {};
