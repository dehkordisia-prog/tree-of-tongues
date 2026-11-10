// Build-time readers for loadEntity: the prerender reads data/build straight from disk.

import type { EntityDeps } from "../../src/data/entity";
import { loadProfile } from "../../src/data/profile/load";
import type { ScopeIndex } from "../../src/data/scopeIndex";

import { buildScopeIndex, dataIsBuilt, readBundleFromDisk, readTreeCounts } from "./scopeIndex.server";

let index: ScopeIndex | null = null;

export function serverIndex(): ScopeIndex {
  index ??= buildScopeIndex();
  return index;
}

export function serverDeps(): EntityDeps {
  const idx = serverIndex();
  return {
    index: idx,
    async getBundle(g) {
      const b = readBundleFromDisk(g);
      return b ? { status: "ok", bundle: b } : { status: "missing" };
    },
    async counts(g) {
      return readTreeCounts()?.counts.get(g) ?? null;
    },
    async dataBuilt() {
      return dataIsBuilt();
    },
    getProfile: loadProfile,
  };
}
