// Stand-in for virtual:tt-scope-index under Vitest (vitest.config.ts), where the Vite plugin does not run.
import type { ScopeIndex } from "./scopeIndex";

const index: ScopeIndex = { built: false, labels: {}, langs: [], families: [], topFamilies: [], pilots: [] };
export default index;
