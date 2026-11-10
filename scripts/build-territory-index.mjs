#!/usr/bin/env node
// Stopgap for the Phase 0 map spike: a reverse index from CLDR territory code to languages.
//
//   node scripts/build-territory-index.mjs
//
// Reads data/build/bundles/*.json (the territory blocks the pipeline already wrote) and writes
// data/build/derived/territory_index.json. No new facts are created: every row is copied from a
// bundle, with the block's provenance kept once at the top. Output is sorted, so it is
// reproducible. The pipeline should emit this file itself (open question in the map spike report);
// when it does, delete this script.

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const bundlesDir = path.join(ROOT, "data/build/bundles");
const outDir = path.join(ROOT, "data/build/derived");

if (!fs.existsSync(bundlesDir)) {
  console.error("territory index: data/build/bundles is missing. Run `uv run pipeline build`.");
  process.exit(1);
}

const byTerritory = {};
let provenance = null;
for (const file of fs.readdirSync(bundlesDir).sort()) {
  if (!file.endsWith(".json")) continue;
  const bundle = JSON.parse(fs.readFileSync(path.join(bundlesDir, file), "utf8"));
  for (const block of bundle.territories ?? []) {
    provenance ??= {
      source_id: block.source_id,
      locator_template: block.locator_template,
      retrieved_at: block.retrieved_at,
      confidence: block.confidence,
      notes: block.notes,
    };
    for (const item of block.items ?? []) {
      (byTerritory[item.iso3166] ??= []).push([bundle.glottocode, item.population_share, item.official_status ?? null]);
    }
  }
}

const territories = {};
for (const code of Object.keys(byTerritory).sort()) {
  territories[code] = byTerritory[code].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
}

fs.mkdirSync(outDir, { recursive: true });
const out = {
  format: "territories[iso3166] is a list of [glottocode, population_share, official_status] sorted by share, descending. Copied from bundles/*.json; nothing is averaged or merged.",
  provenance,
  territories,
};
fs.writeFileSync(path.join(outDir, "territory_index.json"), JSON.stringify(out) + "\n");
console.log(`territory index: ${Object.keys(territories).length} territories, wrote data/build/derived/territory_index.json`);
