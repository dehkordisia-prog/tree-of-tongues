// Top-level family to color token. Only the 11 named families get a token; everything else
// (other families, isolates, Glottolog pseudo-families such as Bookkeeping) is "other".
// A mapping applies only when the Glottolog name in tree.json matches the expected name.
// Checked against data/build/tree.json when this was written: all 11 glottocodes exist and all
// names match. Atlantic-Congo is the closest Glottolog family to the "Niger-Congo" token;
// Glottolog has no Niger-Congo node, so Mande, Dogon and others fall under "other".

import type { FamilyId } from "@/design/tokens";

export interface FamilyRule {
  glottocode: string;
  /** Glottolog name that must match tree.json. */
  glottologName: string;
  token: FamilyId;
}

export const FAMILY_RULES: readonly FamilyRule[] = [
  { glottocode: "indo1319", glottologName: "Indo-European", token: "indo-european" },
  { glottocode: "sino1245", glottologName: "Sino-Tibetan", token: "sino-tibetan" },
  { glottocode: "afro1255", glottologName: "Afro-Asiatic", token: "afro-asiatic" },
  { glottocode: "aust1307", glottologName: "Austronesian", token: "austronesian" },
  { glottocode: "atla1278", glottologName: "Atlantic-Congo", token: "niger-congo" },
  { glottocode: "drav1251", glottologName: "Dravidian", token: "dravidian" },
  { glottocode: "turk1311", glottologName: "Turkic", token: "turkic" },
  { glottocode: "japo1237", glottologName: "Japonic", token: "japonic" },
  { glottocode: "kore1284", glottologName: "Koreanic", token: "koreanic" },
  { glottocode: "taik1256", glottologName: "Tai-Kadai", token: "kra-dai" },
  { glottocode: "ural1272", glottologName: "Uralic", token: "uralic" },
];

export const FAMILY_ORDER: readonly FamilyId[] = [
  "indo-european",
  "sino-tibetan",
  "afro-asiatic",
  "austronesian",
  "niger-congo",
  "dravidian",
  "turkic",
  "japonic",
  "koreanic",
  "kra-dai",
  "uralic",
  "other",
];

export const OTHER_INDEX = FAMILY_ORDER.indexOf("other");

const byCode = new Map(FAMILY_RULES.map((r) => [r.glottocode, r]));

/** Family index (into FAMILY_ORDER) of a top-level node. Unknown codes and name mismatches give "other". */
export function familyIndexOf(glottocode: string, name: string): number {
  const rule = byCode.get(glottocode);
  if (!rule || rule.glottologName !== name) return OTHER_INDEX;
  return FAMILY_ORDER.indexOf(rule.token);
}

export interface FamilyMismatch {
  glottocode: string;
  expectedName: string;
  found: string | null;
}

/** Rules whose glottocode is missing from the data or whose name differs. Empty when all is well. */
export function familyMismatches(nodes: readonly { glottocode: string; name: string }[]): FamilyMismatch[] {
  const names = new Map(nodes.map((n) => [n.glottocode, n.name]));
  const out: FamilyMismatch[] = [];
  for (const r of FAMILY_RULES) {
    const found = names.get(r.glottocode) ?? null;
    if (found !== r.glottologName) out.push({ glottocode: r.glottocode, expectedName: r.glottologName, found });
  }
  return out;
}
