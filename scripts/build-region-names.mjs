#!/usr/bin/env node
// Region (country and territory) display names for the UI, pinned to CLDR 49.
//
//   node scripts/build-region-names.mjs
//
// Why: Intl.DisplayNames returns whatever CLDR version the runtime's ICU ships. Node at
// build time and each browser differ (for example HK, MO, FK and PS in English), so a name
// rendered into prerendered HTML did not match the browser's own render (React error #418).
// Pinning the names to one CLDR release makes them identical everywhere, and matches the
// "CLDR 49" citation the Inspector shows beside them.
//
// Reads data/raw/cldr-49 (immutable downloads, see data/raw/MANIFEST.yaml; cleared in
// data/LICENSES.yaml under cldr-49) and writes apps/web/src/i18n/regions/{en,fa,tr}.json.
// The outputs are committed because CI has no data/raw. Only ISO 3166-1 alpha-2 keys and
// default (non-alt) names are kept.

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const RAW = path.join(ROOT, "data/raw/cldr-49");
const OUT = path.join(ROOT, "apps/web/src/i18n/regions");
const LOCALES = ["en", "fa", "tr"];

if (!fs.existsSync(RAW)) {
  console.error("build-region-names: data/raw/cldr-49 is missing. Run `uv run pipeline fetch` first.");
  process.exit(1);
}
const dated = fs
  .readdirSync(RAW)
  .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
  .sort();
const dir = path.join(RAW, dated.at(-1));

fs.mkdirSync(OUT, { recursive: true });
for (const locale of LOCALES) {
  const file = path.join(dir, `cldr-localenames-full__main__${locale}__territories.json`);
  const territories = JSON.parse(fs.readFileSync(file, "utf8")).main[locale].localeDisplayNames.territories;
  const names = Object.fromEntries(
    Object.entries(territories)
      .filter(([code]) => /^[A-Z]{2}$/.test(code))
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  );
  fs.writeFileSync(path.join(OUT, `${locale}.json`), JSON.stringify(names, null, 1) + "\n");
  console.log(`build-region-names: ${locale}: ${Object.keys(names).length} names`);
}
fs.copyFileSync(
  path.join(dir, "LICENSE"),
  path.join(OUT, "NOTICE-cldr-49-unicode-license.txt"),
);
