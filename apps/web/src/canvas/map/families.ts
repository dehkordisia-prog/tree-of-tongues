// Family colors for language points. The family is the top-level Glottolog family of the languoid,
// read from data/build/tree.json (parent index per node). Marks come from design/tokens.ts.
//
// Mapping from Glottolog top-level family (Glottocode) to a token family:
//   indo1319 Indo-European, sino1245 Sino-Tibetan, afro1255 Afro-Asiatic, aust1307 Austronesian,
//   atla1278 Atlantic-Congo (stands in for Niger-Congo; Glottolog keeps Mande separate, D-002),
//   drav1251 Dravidian, turk1311 Turkic, japo1237 Japonic, kore1284 Koreanic,
//   taik1256 Tai-Kadai (the token "Kra-Dai"), ural1272 Uralic.
// Everything else, including isolates, pidgins and unclassified, is "other".
// Glottolog's classification is a hypothesis, not a verdict: families that other schools join
// (Altaic, Austric) stay separate here.

import { families, type FamilyId } from "@/design/tokens";

export const ROOT_TO_FAMILY: Readonly<Record<string, FamilyId>> = {
  indo1319: "indo-european",
  sino1245: "sino-tibetan",
  afro1255: "afro-asiatic",
  aust1307: "austronesian",
  atla1278: "niger-congo",
  drav1251: "dravidian",
  turk1311: "turkic",
  japo1237: "japonic",
  kore1284: "koreanic",
  taik1256: "kra-dai",
  ural1272: "uralic",
};

/** Order used for indexes in typed arrays. */
export const FAMILY_ORDER: readonly FamilyId[] = families.map((f) => f.id);
export const OTHER_INDEX = FAMILY_ORDER.indexOf("other");

export interface TreeFile {
  /** Tuples: [glottocode, parent_index (-1 = root), level, name, ...]. */
  nodes: readonly (readonly [string, number, number, string, ...unknown[]])[];
}

/** Family index (into FAMILY_ORDER) for every glottocode in the tree. */
export function familyIndexByGlottocode(tree: TreeFile): Map<string, number> {
  const nodes = tree.nodes;
  const rootOf = new Int32Array(nodes.length).fill(-2);
  const resolve = (start: number): number => {
    const path: number[] = [];
    let i = start;
    while (rootOf[i] === -2) {
      path.push(i);
      const parent = nodes[i]![1];
      if (parent < 0) {
        rootOf[i] = i;
        break;
      }
      i = parent;
    }
    const root = rootOf[i]!;
    for (const p of path) rootOf[p] = root;
    return root;
  };
  const out = new Map<string, number>();
  nodes.forEach((n, i) => {
    const family = ROOT_TO_FAMILY[nodes[resolve(i)]![0]];
    out.set(n[0], family ? FAMILY_ORDER.indexOf(family) : OTHER_INDEX);
  });
  return out;
}
