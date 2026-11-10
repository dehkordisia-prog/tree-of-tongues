// Entity data for the Inspector, shared by the build-time loader (prerender, reads data/build from
// disk) and the clientLoader (SPA navigation and fallback, fetches /data/). Pure apart from the
// injected readers. Entity data never enters the store (spec 3.1).

import type { Bundle, BundleResult } from "./bundle";
import { familyDeeper, languageDeeper, worldDeeper, type DeeperCard } from "./deeper";
import { labelFor } from "./names";
import type { Profile } from "./profile/types";
import type { ScopeIndex } from "./scopeIndex";
import type { Lens } from "@/state/url";

export type EntityKind = "language" | "family";

export interface Crumb {
  glottocode: string;
  name: string;
  kind: EntityKind;
}

export interface SisterRow {
  glottocode: string;
  name: string;
  level: string;
}

/** The Lumper/Splitter group of a language (D-022, D-023), from the scope list. */
export interface LumpInfo {
  group: string;
  /** The group label as the scope list words it. */
  label: string | null;
  ownerDecision: string | null;
  /** inspector_note of this language's scope entry; null for a member without its own entry. */
  note: string | null;
  members: { g: string; label: string }[];
}

export function lumpFor(index: ScopeIndex, glottocode: string): LumpInfo | null {
  const own = index.lumpNotes?.[glottocode];
  const grp =
    (own && index.lumpGroups?.find((x) => x.id === own.group)) ??
    index.lumpGroups?.find((x) => x.members.some((m) => m.g === glottocode));
  if (!grp) return null;
  return { group: grp.id, label: grp.label, ownerDecision: grp.ownerDecision, note: own?.note ?? null, members: grp.members };
}

export interface EntityOk {
  status: "ok";
  kind: EntityKind;
  glottocode: string;
  label: string;
  bundle: Bundle;
  /** Root family first, the entity last. */
  crumbs: Crumb[];
  deeper: DeeperCard[];
  /** Families: Glottolog counts below the node (tree.json). Null when tree.json is absent. */
  counts: [languages: number, dialects: number] | null;
  /** Languages: the other children of the parent (from the parent bundle), scope languages first. */
  sisters: SisterRow[] | null;
  /** Glottocodes with a profile in this atlas (scope list), for "Profile" flags and counts. */
  inScope: string[];
  inAtlas: number | null;
  /** Languages: the profile prose, when content/languages/{glottocode}.md exists. */
  profile: Profile | null;
  lump: LumpInfo | null;
}

export interface EntityMissing {
  status: "not-found" | "unavailable";
  kind: EntityKind;
  glottocode: string;
  /** The name when the scope list knows it (search and canvas also pass it). */
  label: string | null;
  crumbs: Crumb[];
  deeper: DeeperCard[];
  /** The profile and the lumper group come from content/, so they show even when data/build is absent. */
  profile: Profile | null;
  lump: LumpInfo | null;
}

export interface EntityRedirect {
  status: "redirect";
  to: string;
}

export type EntityData = EntityOk | EntityMissing | EntityRedirect;

export interface WorldData {
  status: "world";
  deeper: DeeperCard[];
}

export interface EntityDeps {
  index: ScopeIndex;
  getBundle(glottocode: string): Promise<BundleResult>;
  counts(glottocode: string): Promise<[number, number] | null>;
  /** Whether the pipeline output exists at all (else a missing bundle is "unavailable", not "not found"). */
  dataBuilt(): Promise<boolean>;
  /** The built profile for a language, if it has one. */
  getProfile?(glottocode: string): Promise<Profile | null>;
}

const levelKind = (level: string): EntityKind => (level === "family" ? "family" : "language");

/** Shrink a bundle for loader data: drop alias names (they only feed search). */
export function slimBundle(b: Bundle): Bundle {
  const rows = Array.isArray(b.names) ? b.names : (b.names?.items ?? []);
  return { ...b, names: { items: rows.filter((n) => n.type !== "alias" && (n.type === "endonym" || n.lang === "en" || n.lang === "fa" || n.lang === "tr")) } };
}

function fallbackCrumbs(index: ScopeIndex, kind: EntityKind, g: string, label: string | null): Crumb[] {
  const lang = index.langs.find((l) => l.g === g);
  const fam = index.families.find((f) => f.g === g);
  const crumbs: Crumb[] = [];
  const path = lang?.lineage ?? [];
  for (const a of path) {
    const f = index.families.find((x) => x.g === a);
    crumbs.push({ glottocode: a, name: f?.name ?? a, kind: "family" });
  }
  if (!path.length && fam) {
    const chain: Crumb[] = [];
    for (let p: typeof fam | undefined = fam; p; p = index.families.find((x) => x.g === p!.parent)) {
      chain.unshift({ glottocode: p.g, name: p.name, kind: "family" });
      if (!p.parent) break;
    }
    return chain;
  }
  crumbs.push({ glottocode: g, name: label ?? g, kind });
  return crumbs;
}

export async function loadEntity(kind: EntityKind, glottocode: string, search: string, lens: Lens, deps: EntityDeps): Promise<EntityData> {
  const { index } = deps;
  const known = index.langs.find((l) => l.g === glottocode) ?? null;
  const knownFam = index.families.find((f) => f.g === glottocode) ?? null;
  const knownLabel = known?.label ?? knownFam?.name ?? null;
  const res = await deps.getBundle(glottocode);
  const extras = async () =>
    kind === "language"
      ? { profile: (await deps.getProfile?.(glottocode)) ?? null, lump: lumpFor(index, glottocode) }
      : { profile: null, lump: null };

  if (res.status !== "ok") {
    const status = res.status === "missing" && (await deps.dataBuilt()) ? "not-found" : "unavailable";
    const crumbs = fallbackCrumbs(index, kind, glottocode, knownLabel);
    const deeper =
      kind === "family"
        ? familyDeeper(index, { glottocode, label: knownLabel ?? glottocode, lineage: crumbs.slice(0, -1).map((c) => ({ glottocode: c.glottocode, name: c.name })), macroareas: knownFam?.macroareas ?? [], lens })
        : languageDeeper(index, { glottocode, label: knownLabel ?? glottocode, lineage: crumbs.slice(0, -1).map((c) => ({ glottocode: c.glottocode, name: c.name })), macroarea: known?.macroarea ?? null, territories: [], lens });
    return {
      status,
      kind,
      glottocode,
      label: knownLabel,
      crumbs,
      deeper: status === "not-found" ? worldDeeper(index, lens) : deeper,
      ...(status === "not-found" ? { profile: null, lump: null } : await extras()),
    };
  }

  const bundle = res.bundle;
  const actual = levelKind(bundle.languoid.level);
  if (actual !== kind) return { status: "redirect", to: `/${actual}/${glottocode}${search}` };

  const label = labelFor(glottocode, bundle.languoid.name, index.labels);
  const lineage = bundle.lineage.map((l) => ({ glottocode: l.glottocode, name: labelFor(l.glottocode, l.name, index.labels) }));
  const crumbs: Crumb[] = [...lineage.map((l) => ({ ...l, kind: "family" as const })), { glottocode, name: label, kind }];
  const inScope = index.langs.filter((l) => l.decided).map((l) => l.g);
  const scopeSet = new Set(inScope);

  if (kind === "family") {
    const counts = await deps.counts(glottocode);
    const macroareas = (bundle.languoid.macroarea ?? "").split(";").filter(Boolean);
    const inAtlas = index.built ? index.langs.filter((l) => l.decided && l.lineage.includes(glottocode)).length : null;
    return {
      status: "ok",
      kind,
      glottocode,
      label,
      bundle: slimBundle(bundle),
      crumbs,
      deeper: familyDeeper(index, { glottocode, label, lineage, macroareas, lens }),
      counts,
      sisters: null,
      inScope,
      inAtlas,
      profile: null,
      lump: null,
    };
  }

  // Sister languages: the parent's other children, scope languages first.
  let sisters: SisterRow[] | null = null;
  const parent = bundle.languoid.parent_glottocode;
  if (parent) {
    const p = await deps.getBundle(parent);
    if (p.status === "ok") {
      sisters = p.bundle.children.items
        .filter(([g, , lvl]) => g !== glottocode && lvl !== "family")
        .map(([g, name, level]) => ({ glottocode: g, name: labelFor(g, name, index.labels), level }))
        .sort((a, b) => Number(scopeSet.has(b.glottocode)) - Number(scopeSet.has(a.glottocode)) || a.name.localeCompare(b.name, "en"));
    }
  }
  const territories = bundle.territories.flatMap((t) => t.items.map((i) => ({ iso: i.iso3166, share: i.population_share })));
  return {
    status: "ok",
    kind,
    glottocode,
    label,
    bundle: slimBundle(bundle),
    crumbs,
    deeper: languageDeeper(index, { glottocode, label, lineage, macroarea: bundle.languoid.macroarea, territories, lens }),
    counts: null,
    sisters,
    inScope,
    inAtlas: null,
    ...(await extras()),
  };
}

export function loadWorld(index: ScopeIndex, lens: Lens): WorldData {
  return { status: "world", deeper: worldDeeper(index, lens) };
}
