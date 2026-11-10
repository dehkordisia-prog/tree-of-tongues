// Browser readers for loadEntity (clientLoader). Bundles are cached for the session: a rebuild of
// data/build during development needs a reload, as with any static file.

import { fetchBundle, type BundleResult } from "./bundle";
import type { EntityDeps } from "./entity";
import { loadProfile } from "./profile/load";
import { loadScopeIndex } from "./scopeIndex";
import { loadTreeCounts } from "./treeCounts";

const cache = new Map<string, Promise<BundleResult>>();

export function getBundleCached(glottocode: string): Promise<BundleResult> {
  let p = cache.get(glottocode);
  if (!p) {
    p = fetchBundle(glottocode).then((r) => {
      if (r.status !== "ok") cache.delete(glottocode); // retry later ("Try again")
      return r;
    });
    cache.set(glottocode, p);
  }
  return p;
}

let built: Promise<boolean> | null = null;
function dataBuilt(): Promise<boolean> {
  built ??= fetch("/data/tree.json", { method: "HEAD" })
    .then((r) => r.ok && !(r.headers.get("content-type") ?? "").includes("text/html"))
    .catch(() => false)
    .then((ok) => {
      if (!ok) built = null;
      return ok;
    });
  return built;
}

export async function clientDeps(): Promise<EntityDeps> {
  const index = await loadScopeIndex();
  return {
    index,
    getBundle: getBundleCached,
    dataBuilt,
    getProfile: loadProfile,
    async counts(g) {
      const fam = index.families.find((f) => f.g === g);
      if (fam?.languages != null && fam.dialects != null) return [fam.languages, fam.dialects];
      return (await loadTreeCounts())?.counts.get(g) ?? null;
    },
  };
}
