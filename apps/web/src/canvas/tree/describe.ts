// Screen-reader text for a node. Names and counts come from tree.json, nothing from memory.

import { LEVEL_DIALECT, LEVEL_FAMILY, LEVEL_LANGUAGE, LEVEL_WORLD, type TreeLayout } from "./layout";

const nf = new Intl.NumberFormat("en");
const plural = (n: number, one: string, many: string) => `${nf.format(n)} ${n === 1 ? one : many}`;

export function levelLabel(level: number): string {
  if (level === LEVEL_FAMILY) return "family";
  if (level === LEVEL_LANGUAGE) return "language";
  if (level === LEVEL_DIALECT) return "dialect";
  return "world";
}

type Describable = Pick<TreeLayout, "name" | "level" | "languages" | "childStart">;

/** "Indo-European, family, 595 languages" */
export function describeNode(L: Describable, v: number): string {
  const level = L.level[v]!;
  const kids = L.childStart[v + 1]! - L.childStart[v]!;
  if (level === LEVEL_WORLD) return `${L.name[v]}, ${plural(kids, "top-level group", "top-level groups")}, ${plural(L.languages[v]!, "language", "languages")}`;
  if (level === LEVEL_FAMILY) return `${L.name[v]}, family, ${plural(L.languages[v]!, "language", "languages")}`;
  if (level === LEVEL_LANGUAGE) return kids > 0 ? `${L.name[v]}, language, ${plural(kids, "dialect", "dialects")}` : `${L.name[v]}, language`;
  return kids > 0 ? `${L.name[v]}, dialect, ${plural(kids, "sub-entry", "sub-entries")}` : `${L.name[v]}, dialect`;
}
