// Go deeper cards (docs/specs/app-shell.md section 4.8). Deterministic fallback, so every view has at
// least three internal exits even without curated links. Pure: the caller passes the scope index.

import type { Lens } from "@/state/url";

import type { IndexFamily, IndexLang, ScopeIndex } from "./scopeIndex";

export type DeeperKind = "related" | "contrast" | "surprise" | "start";

export type DeeperTarget =
  | { type: "language"; glottocode: string; lens?: Lens }
  | { type: "family"; glottocode: string; lens?: Lens }
  | { type: "world"; lens?: Lens };

export type DeeperReason =
  | { key: "sameBranch"; group: string }
  | { key: "parent" }
  | { key: "sharesPlace"; place: string }
  | { key: "sameArea"; macroarea: string }
  | { key: "member" }
  | { key: "pilot" }
  | { key: "bigFamily"; count: number }
  | { key: "otherLens"; lens: Lens }
  | { key: "world" };

export interface DeeperCard {
  kind: DeeperKind;
  target: DeeperTarget;
  label: string;
  reason: DeeperReason;
}

export function targetKey(t: DeeperTarget): string {
  return t.type === "world" ? `world:${t.lens ?? ""}` : `${t.type}:${t.glottocode}:${t.lens ?? ""}`;
}

/** What the caller knows about the entity on screen. */
export interface LanguageSubject {
  glottocode: string;
  label: string;
  /** Root family first, parent last. */
  lineage: { glottocode: string; name: string }[];
  macroarea: string | null;
  territories: { iso: string; share: number | null }[];
  lens: Lens;
}

export interface FamilySubject {
  glottocode: string;
  label: string;
  lineage: { glottocode: string; name: string }[];
  macroareas: string[];
  lens: Lens;
}

function lcaDepth(a: readonly string[], b: readonly string[]): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

const byLabel = (a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label, "en");

function familyName(index: ScopeIndex, g: string, fallback?: string): string {
  return index.labels[g] ?? index.families.find((f) => f.g === g)?.name ?? fallback ?? g;
}

function finish(subjectKey: string, cards: (DeeperCard | null)[], fill: DeeperCard[]): DeeperCard[] {
  const seen = new Set([subjectKey]);
  const out: DeeperCard[] = [];
  for (const c of [...cards, ...fill]) {
    if (!c) continue;
    const k = targetKey(c.target);
    if (seen.has(k)) continue;
    // Fill cards are added only while fewer than three remain (spec 4.8).
    if (fill.includes(c) && out.length >= 3) break;
    seen.add(k);
    out.push(c);
  }
  return out.slice(0, 6);
}

function fillCards(index: ScopeIndex, top: { g: string; name: string } | null, self: DeeperTarget, selfLabel: string, lens: Lens): DeeperCard[] {
  const other: Lens = lens === "tree" ? "map" : "tree";
  const fam = index.families.find((f) => f.g === top?.g);
  const cards: DeeperCard[] = [];
  if (top) {
    cards.push({
      kind: "related",
      target: { type: "family", glottocode: top.g },
      label: familyName(index, top.g, top.name),
      reason: fam?.languages ? { key: "bigFamily", count: fam.languages } : { key: "parent" },
    });
  }
  cards.push({ kind: "start", target: { type: "world" }, label: "", reason: { key: "world" } });
  cards.push({ kind: "contrast", target: { ...self, lens: other } as DeeperTarget, label: selfLabel, reason: { key: "otherLens", lens: other } });
  // Last resort (no lineage known, for example without data): the world view in the other lens.
  cards.push({ kind: "start", target: { type: "world", lens: other }, label: "", reason: { key: "otherLens", lens: other } });
  return cards;
}

export function languageDeeper(index: ScopeIndex, s: LanguageSubject): DeeperCard[] {
  const self = s.lineage.map((l) => l.glottocode);
  const top = s.lineage[0] ?? null;
  const others = index.langs.filter((l) => l.g !== s.glottocode && l.decided);

  // Related: nearest scope language by tree distance; else the parent family.
  let related: DeeperCard | null = null;
  if (self.length) {
    let best: { l: IndexLang; d: number; lca: number } | null = null;
    for (const l of others) {
      if (!l.lineage.length) continue;
      const lca = lcaDepth(self, l.lineage);
      if (lca === 0) continue;
      const d = self.length + l.lineage.length - 2 * lca;
      if (!best || d < best.d || (d === best.d && l.label.localeCompare(best.l.label, "en") < 0)) best = { l, d, lca };
    }
    if (best) {
      const group = s.lineage[best.lca - 1]!;
      related = {
        kind: "related",
        target: { type: "language", glottocode: best.l.g },
        label: best.l.label,
        reason: { key: "sameBranch", group: familyName(index, group.glottocode, group.name) },
      };
    }
  }
  const parent = s.lineage.at(-1);
  if (!related && parent) {
    related = { kind: "related", target: { type: "family", glottocode: parent.glottocode }, label: familyName(index, parent.glottocode, parent.name), reason: { key: "parent" } };
  }

  // Contrast: a scope language of another top-level family that shares a territory; else same macroarea.
  let contrast: DeeperCard | null = null;
  const foreign = others.filter((l) => l.top && top && l.top !== top.glottocode);
  const mine = [...s.territories].sort((a, b) => (b.share ?? -1) - (a.share ?? -1));
  for (const t of mine) {
    const there = foreign
      .map((l) => ({ l, share: l.terr.find((x) => x[0] === t.iso)?.[1] }))
      .filter((x) => x.share !== undefined)
      .sort((a, b) => (b.share ?? -1) - (a.share ?? -1) || byLabel(a.l, b.l));
    if (there[0]) {
      contrast = { kind: "contrast", target: { type: "language", glottocode: there[0].l.g }, label: there[0].l.label, reason: { key: "sharesPlace", place: t.iso } };
      break;
    }
  }
  if (!contrast && s.macroarea) {
    const same = foreign.filter((l) => l.macroarea === s.macroarea).sort(byLabel)[0];
    if (same) contrast = { kind: "contrast", target: { type: "language", glottocode: same.g }, label: same.label, reason: { key: "sameArea", macroarea: s.macroarea } };
  }

  // Surprise: curated (none yet); the country route is not built yet; so its top-level family.
  const surprise: DeeperCard | null = top
    ? {
        kind: "surprise",
        target: { type: "family", glottocode: top.glottocode },
        label: familyName(index, top.glottocode, top.name),
        reason: bigFamilyReason(index.families.find((f) => f.g === top.glottocode)),
      }
    : null;

  const selfTarget: DeeperTarget = { type: "language", glottocode: s.glottocode };
  return finish(targetKey(selfTarget), [related, contrast, surprise], fillCards(index, top ? { g: top.glottocode, name: top.name } : null, selfTarget, s.label, s.lens));
}

function bigFamilyReason(f: IndexFamily | undefined): DeeperReason {
  return f?.languages ? { key: "bigFamily", count: f.languages } : { key: "parent" };
}

export function familyDeeper(index: ScopeIndex, s: FamilySubject): DeeperCard[] {
  const parent = s.lineage.at(-1);
  const top = s.lineage[0] ?? { glottocode: s.glottocode, name: s.label };
  const tops = index.families.filter((f) => f.parent === null && f.g !== top.glottocode);

  // Related: its parent, or a sibling family.
  let related: DeeperCard | null = null;
  if (parent) {
    related = { kind: "related", target: { type: "family", glottocode: parent.glottocode }, label: familyName(index, parent.glottocode, parent.name), reason: { key: "parent" } };
  } else {
    const sib = [...tops].sort((a, b) => (b.languages ?? 0) - (a.languages ?? 0) || a.name.localeCompare(b.name, "en"))[0];
    if (sib) related = { kind: "related", target: { type: "family", glottocode: sib.g }, label: sib.name, reason: bigFamilyReason(sib) };
  }

  // Contrast: another top-level family in the same macroarea.
  let contrast: DeeperCard | null = null;
  const topInfo = index.families.find((f) => f.g === top.glottocode);
  const areas = s.macroareas.length ? s.macroareas : (topInfo?.macroareas ?? []);
  for (const area of areas) {
    const f = tops.filter((x) => x.macroareas.includes(area)).sort((a, b) => (b.languages ?? 0) - (a.languages ?? 0) || a.name.localeCompare(b.name, "en"));
    const pick = f.find((x) => !(related && related.target.type === "family" && related.target.glottocode === x.g));
    if (pick) {
      contrast = { kind: "contrast", target: { type: "family", glottocode: pick.g }, label: pick.name, reason: { key: "sameArea", macroarea: area } };
      break;
    }
  }

  // Surprise: curated (none yet); else its scope member with the most dialects.
  const members = index.langs.filter((l) => l.decided && l.lineage.includes(s.glottocode)).sort((a, b) => b.dialects - a.dialects || byLabel(a, b));
  const m = members[0];
  const surprise: DeeperCard | null = m ? { kind: "surprise", target: { type: "language", glottocode: m.g }, label: m.label, reason: { key: "member" } } : null;

  const selfTarget: DeeperTarget = { type: "family", glottocode: s.glottocode };
  const fillTop = top.glottocode === s.glottocode ? null : { g: top.glottocode, name: top.name };
  return finish(targetKey(selfTarget), [related, contrast, surprise], fillCards(index, fillTop, selfTarget, s.label, s.lens));
}

/** World view: the pilot profiles, then the three largest top-level families. */
export function worldDeeper(index: ScopeIndex, lens: Lens): DeeperCard[] {
  const cards: DeeperCard[] = [];
  for (const g of index.pilots) {
    const l = index.langs.find((x) => x.g === g);
    if (l) cards.push({ kind: "start", target: { type: "language", glottocode: g }, label: l.label, reason: { key: "pilot" } });
  }
  for (const f of index.topFamilies.slice(0, 3)) {
    cards.push({ kind: "start", target: { type: "family", glottocode: f.g }, label: index.labels[f.g] ?? f.name, reason: { key: "bigFamily", count: f.languages } });
  }
  if (cards.length < 3) {
    // No data built: fall back to top-level families named in the scope list, then the other lens.
    for (const f of index.families.filter((x) => x.parent === null).slice(0, 3 - cards.length)) {
      cards.push({ kind: "start", target: { type: "family", glottocode: f.g }, label: f.name, reason: { key: "parent" } });
    }
    const other: Lens = lens === "tree" ? "map" : "tree";
    if (cards.length < 3) cards.push({ kind: "start", target: { type: "world", lens: other }, label: "", reason: { key: "otherLens", lens: other } });
  }
  return cards;
}
