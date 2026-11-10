// Build-time only (Node): reads content/languages/{glottocode}.md and content/sources.bib and builds
// the profile JSON (src/data/profile/profile.ts). Served to the app as virtual modules by the
// profiles plugin in vite.config.ts: one small index, and one lazily loaded chunk per profile.
// A profile that cites a key missing from sources.bib, or has a malformed language mark, throws,
// which fails the build.

import fs from "node:fs";
import path from "node:path";

import { parseBibtex } from "../../src/data/profile/bibtex.ts";
import { buildProfile } from "../../src/data/profile/profile.ts";
import type { BibEntry, Profile } from "../../src/data/profile/types.ts";

const REPO = path.resolve(import.meta.dirname, "../../../..");
export const PROFILE_DIR = path.join(REPO, "content/languages");
export const BIB_FILE = path.join(REPO, "content/sources.bib");

const GLOTTOCODE_FILE = /^([a-z0-9]{4}[0-9]{4})\.md$/;

/** Glottocodes that have a profile file, sorted. */
export function profileGlottocodes(): string[] {
  let names: string[];
  try {
    names = fs.readdirSync(PROFILE_DIR);
  } catch {
    return [];
  }
  return names
    .map((n) => GLOTTOCODE_FILE.exec(n)?.[1])
    .filter((g): g is string => !!g)
    .sort();
}

export function readBib(): Map<string, BibEntry> {
  return parseBibtex(fs.readFileSync(BIB_FILE, "utf8"), "content/sources.bib");
}

export function profileFile(glottocode: string): string {
  return path.join(PROFILE_DIR, `${glottocode}.md`);
}

export function readProfile(glottocode: string, bib: Map<string, BibEntry> = readBib()): Profile {
  return buildProfile(fs.readFileSync(profileFile(glottocode), "utf8"), bib, {
    file: `content/languages/${glottocode}.md`,
    glottocode,
  });
}

/** Build every profile once (fails on the first error): used at build start. */
export function checkAllProfiles(): void {
  const bib = readBib();
  for (const g of profileGlottocodes()) readProfile(g, bib);
}
