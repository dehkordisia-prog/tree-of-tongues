// One search engine for the session. Tier 1 loads on idle after first paint and on palette open;
// tier 2 when the palette opens (spec 7.1). Both stay out of the app-shell chunk.

import { loadScopeIndex } from "@/data/scopeIndex";
import { loadTreeCounts } from "@/data/treeCounts";

import { SearchEngine } from "./engine";
import { fetchPipeline, fromPipeline, PIPELINE_URLS, tier1FromIndex, tier2FromTree } from "./source";

export const engine = new SearchEngine();
export type TierSource = "pipeline" | "derived" | "none";
export const sources: { tier1: TierSource; tier2: TierSource } = { tier1: "none", tier2: "none" };

let t1: Promise<void> | null = null;
let t2: Promise<void> | null = null;

export function ensureTier1(): Promise<void> {
  t1 ??= (async () => {
    const index = await loadScopeIndex();
    const docs = fromPipeline(await fetchPipeline(PIPELINE_URLS.tier1), index.labels);
    if (docs) {
      engine.add(docs);
      sources.tier1 = "pipeline";
    } else {
      engine.add(tier1FromIndex(index));
      sources.tier1 = "derived";
    }
  })();
  return t1;
}

export function ensureTier2(): Promise<void> {
  t2 ??= (async () => {
    await ensureTier1();
    const index = await loadScopeIndex();
    const docs = fromPipeline(await fetchPipeline(PIPELINE_URLS.tier2), index.labels);
    if (docs) {
      engine.add(docs);
      sources.tier2 = "pipeline";
      return;
    }
    const tree = await loadTreeCounts();
    if (tree) {
      engine.add(tier2FromTree(tree, index.labels));
      sources.tier2 = "derived";
    } else {
      t2 = null; // try again on the next open (a rebuild may be running)
    }
  })();
  return t2;
}
