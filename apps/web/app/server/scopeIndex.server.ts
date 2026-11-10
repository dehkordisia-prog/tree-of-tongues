// Build-time only (Node): reads the scope list, the scope bundles and tree.json, and produces the
// ScopeIndex served as virtual:tt-scope-index and the prerender list. Works without data/build
// (CI): the index then carries only what the scope list states, with built = false.

import fs from "node:fs";
import path from "node:path";

import type { Bundle } from "../../src/data/bundle.ts";
import { nameRows } from "../../src/data/bundle.ts";
import { LABEL_FALLBACKS } from "../../src/data/names.ts";
import {
  prerenderTargets,
  readScope,
  scopeLabel,
  type Level,
  type PrerenderTarget,
  type ScopeFile,
} from "../../src/data/scope.ts";
import type { IndexFamily, IndexLang, ScopeIndex } from "../../src/data/scopeIndex.ts";
import { countTree, type TreeCounts, type TreeNodeRow } from "../../src/data/treeCounts.ts";
import { parseYaml } from "../../src/data/yamlLite.ts";

const REPO = path.resolve(import.meta.dirname, "../../../..");
export const DATA_DIR = path.join(REPO, "data/build");
export const SCOPE_FILE = path.join(REPO, "content/scope/phase-1-languages.yaml");

export function readScopeFile(): ScopeFile {
  return readScope(parseYaml(fs.readFileSync(SCOPE_FILE, "utf8")));
}

export function scopePrerenderPaths(): PrerenderTarget[] {
  return prerenderTargets(readScopeFile());
}

export function readBundleFromDisk(glottocode: string): Bundle | null {
  if (!/^[a-z0-9]{4}[0-9]{4}$/.test(glottocode)) return null;
  try {
    return JSON.parse(
      fs.readFileSync(path.join(DATA_DIR, "bundles", `${glottocode}.json`), "utf8"),
    ) as Bundle;
  } catch {
    return null;
  }
}

let treeCache: TreeCounts | null | undefined;

export function readTreeCounts(): TreeCounts | null {
  if (treeCache !== undefined) return treeCache;
  try {
    const file = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "tree.json"), "utf8")) as {
      nodes: TreeNodeRow[];
    };
    treeCache = countTree(file.nodes);
  } catch {
    treeCache = null;
  }
  return treeCache;
}

/** True when the pipeline output is present (CI builds without it). */
export function dataIsBuilt(): boolean {
  return fs.existsSync(path.join(DATA_DIR, "tree.json"));
}

export function buildScopeIndex(): ScopeIndex {
  const scope = readScopeFile();
  const tree = readTreeCounts();
  const labels: Record<string, string> = { ...LABEL_FALLBACKS };
  for (const e of scope.languages) if (e.glottocode && e.displayName) labels[e.glottocode] = e.displayName;

  const famByName = new Map(scope.families.filter((f) => f.depth === 0).map((f) => [f.name, f.glottocode]));
  const famById = new Map(scope.families.map((f) => [f.glottocode, f]));
  let built = false;

  const langs: IndexLang[] = [];
  const seen = new Set<string>();
  const addLang = (
    g: string,
    lvl: Level | null,
    label: string,
    decided: boolean,
    familyPath: string | null,
    iso: string | null,
    confidence: string | null,
  ) => {
    if (seen.has(g) || lvl === "family") return;
    seen.add(g);
    const b = readBundleFromDisk(g);
    if (b) built = true;
    const terr: IndexLang["terr"] = [];
    for (const block of b?.territories ?? []) {
      for (const t of block.items) terr.push([t.iso3166, t.population_share, t.official_status ? 1 : 0]);
    }
    const names: IndexLang["names"] = [];
    if (b) {
      const keep = new Set<string>();
      for (const r of nameRows(b)) {
        if (r.type === "alias") continue;
        if (!(r.type === "endonym" || r.lang === "fa" || r.lang === "tr" || r.lang === "en")) continue;
        if (r.source_id !== "cldr-49" && r.source_id !== "wikidata" && r.type !== "endonym") continue;
        const k = `${r.name}|${r.lang}`;
        if (keep.has(k)) continue;
        keep.add(k);
        names.push([r.name, r.lang, r.type]);
      }
    }
    langs.push({
      g,
      label: labels[g] ?? label,
      level: (b?.languoid.level as Level | undefined) ?? lvl ?? "language",
      lineage: b?.lineage.map((x) => x.glottocode) ?? [],
      top: b?.lineage[0]?.glottocode ?? (familyPath ? (famByName.get(familyPath) ?? null) : null),
      macroarea: b?.languoid.macroarea ?? null,
      terr,
      dialects: b?.children.total ?? 0,
      iso: b?.languoid.iso639_3 ?? iso,
      decided,
      confidence,
      names,
      parentName: b?.lineage.at(-1)?.name ?? null,
    });
  };
  for (const e of scope.languages) {
    if (e.glottocode) {
      if (!e.page)
        addLang(e.glottocode, e.level, scopeLabel(e), true, e.familyPath, e.iso639_3, e.confidence);
    } else {
      for (const c of e.candidates)
        addLang(
          c.glottocode,
          c.level,
          labels[c.glottocode] ?? c.glottologName ?? c.glottocode,
          false,
          e.familyPath,
          null,
          "contested",
        );
    }
  }

  const families: IndexFamily[] = scope.families.map((f) => {
    const b = readBundleFromDisk(f.glottocode);
    let top: string | null = f.glottocode;
    for (let p = f; p.parent;) {
      const up = famById.get(p.parent);
      if (!up) break;
      top = up.glottocode;
      p = up;
    }
    const c = tree?.counts.get(f.glottocode);
    return {
      g: f.glottocode,
      name: labels[f.glottocode] ?? f.name,
      parent: f.parent,
      top: f.depth === 0 ? f.glottocode : (b?.lineage[0]?.glottocode ?? top),
      macroareas: (b?.languoid.macroarea ?? "").split(";").filter(Boolean),
      languages: c?.[0] ?? null,
      dialects: c?.[1] ?? null,
    };
  });

  const pick = (chart: string) =>
    scope.languages.find((e) => e.chartName === chart && e.glottocode && !e.page)?.glottocode;
  // The pilot trio (docs/ROADMAP.md). An entry still contested without a node is left out, never guessed.
  const pilots = ["Iranian Persian", "Turkish", "English"].map(pick).filter((g): g is string => !!g);

  return { built, labels, langs, families, topFamilies: tree?.top.slice(0, 12) ?? [], pilots };
}
