// Turn one profile file (content/languages/{glottocode}.md) plus content/sources.bib into the JSON the
// Inspector renders. Build time only. Rules (CLAUDE.md, nerd contract 2):
//   - every citation key must exist in sources.bib, or the build fails (ProfileError);
//   - TODO(verify) markers become Unverified chips, never raw text; HTML comments are dropped;
//   - the profile's own "Sources" section is replaced by the numbered list built from the citations.
//
// Placement (docs/specs/app-shell.md 4.1, 4.2). The spec has no Profile tab, so each H2 goes to the
// tab it belongs to; anything the spec does not place stays on Overview, in document order:
//   Hook -> top of Overview;  At a glance -> under the data At a glance ("Notes from the profile");
//   Story, Grammar DNA, Culture shelf, Oddity, Open questions and unknown sections -> Overview;
//   Writing -> Writing;  Sounds, Hear it then -> Sounds;  Words -> Words;  Connections -> Family;
//   Go deeper -> Overview, before the Go deeper cards;  Sources -> replaced (Sources tab).

import { accessOf, formatNames, pages } from "./bibtex.ts";
import { MarkdownError, parseBlocks, parseInline, plainText, slug, splitFrontmatter, splitText, stripComments } from "./markdown.ts";
import type { BibEntry, Block, Inline, Profile, ProfileSource, ProfileTab, ReviewStatus, Section } from "./types.ts";
import { parseYaml, type YamlValue } from "../yamlLite.ts";

export class ProfileError extends Error {}

type Slot = "hook" | "glance" | "overview" | "curated" | "drop" | ProfileTab;

const PLACE: Record<string, Slot> = {
  hook: "hook",
  "at a glance": "glance",
  story: "overview",
  "grammar dna": "overview",
  "culture shelf": "overview",
  "open questions": "overview",
  writing: "writing",
  sounds: "sounds",
  "hear it then": "sounds",
  words: "words",
  connections: "family",
  "go deeper": "curated",
  sources: "drop",
};

export function slotOf(title: string): Slot {
  return PLACE[title.trim().toLowerCase()] ?? "overview";
}

/* ---------------------------------------------------------------- walking */

function eachInline(blocks: Block[], fn: (n: Inline) => void) {
  const walk = (nodes: Inline[]) => {
    for (const n of nodes) {
      fn(n);
      if (typeof n !== "string" && (n.t === "em" || n.t === "strong" || n.t === "link" || n.t === "lang")) walk(n.c);
    }
  };
  for (const b of blocks) {
    if (b.t === "h" || b.t === "p") walk(b.c);
    else if (b.t === "list") for (const it of b.items) eachInline(it, fn);
    else if (b.t === "table") {
      b.head.forEach(walk);
      b.rows.forEach((r) => r.forEach(walk));
    } else if (b.t === "quote") eachInline(b.c, fn);
  }
}

function sectionsOf(blocks: Block[], used: Set<string>): { title: string | null; sections: Section[] } {
  let title: string | null = null;
  const sections: Section[] = [];
  let cur: Section | null = null;
  for (const b of blocks) {
    if (b.t === "h" && b.level === 1) {
      title ??= plainText(b.c);
      continue;
    }
    if (b.t === "h" && b.level === 2) {
      const text = plainText(b.c).trim();
      cur = { title: text, id: uniqueId(`profile-${slug(text)}`, used), blocks: [] };
      sections.push(cur);
      continue;
    }
    if (b.t === "h") b.id = uniqueId(`profile-${b.id}`, used);
    if (!cur) {
      // Text before the first H2 (rare): keep it, on Overview.
      cur = { title: "", id: uniqueId("profile-intro", used), blocks: [] };
      sections.push(cur);
    }
    cur.blocks.push(b);
  }
  return { title, sections };
}

function uniqueId(id: string, used: Set<string>): string {
  let out = id;
  for (let k = 2; used.has(out); k++) out = `${id}-${k}`;
  used.add(out);
  return out;
}

/* ------------------------------------------------------------ frontmatter */

type Obj = { [k: string]: YamlValue };
const isObj = (v: YamlValue | undefined): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: YamlValue | undefined) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : null);

const DONE = new Set(["done", "approved", "pass", "passed", "complete", "completed"]);

/* -------------------------------------------------------------- the build */

export interface BuildOptions {
  /** For messages: the file path relative to the repo. */
  file: string;
  /** Expected glottocode (the file name). */
  glottocode: string;
}

export function buildProfile(md: string, bib: Map<string, BibEntry>, opts: BuildOptions): Profile {
  const where = `${opts.file}: `;
  const { yaml, body } = splitFrontmatter(md);
  if (yaml === null) throw new ProfileError(`${where}missing YAML frontmatter`);
  let front: YamlValue;
  try {
    front = parseYaml(yaml);
  } catch (e) {
    throw new ProfileError(`${where}frontmatter: ${(e as Error).message}`);
  }
  const fm: Obj = isObj(front) ? front : {};
  const g = str(fm.glottocode);
  if (g !== opts.glottocode) throw new ProfileError(`${where}frontmatter glottocode is ${g ?? "missing"}, expected ${opts.glottocode}`);
  const status = str(fm.status);
  const reviews: ReviewStatus[] = isObj(fm.review)
    ? Object.entries(fm.review).map(([role, s]) => ({ role, status: str(s) ?? "unknown" }))
    : [];
  // Conservative: anything but a finished status, or any review not done, keeps the banner.
  const draft =
    !DONE.has((status ?? "").toLowerCase()) && status !== "published" ? true : reviews.some((r) => !DONE.has(r.status.toLowerCase()));

  let blocks: Block[];
  try {
    blocks = parseBlocks(stripComments(body, where), { where });
  } catch (e) {
    if (e instanceof MarkdownError) throw new ProfileError(e.message);
    throw e;
  }
  const { sections } = sectionsOf(blocks, new Set());

  const out: Profile = {
    glottocode: opts.glottocode,
    status,
    reviews,
    draft,
    hook: null,
    glance: null,
    overview: [],
    curated: null,
    tabs: { writing: [], sounds: [], words: [], family: [] },
    sources: [],
    unverified: 0,
  };
  for (const s of sections) {
    const slot = slotOf(s.title);
    if (slot === "drop") continue;
    if (slot === "hook" || slot === "glance" || slot === "curated") {
      if (out[slot]) out.overview.push(s); // a second one is kept, never lost
      else out[slot] = s;
    } else if (slot === "overview") out.overview.push(s);
    else out.tabs[slot].push(s);
  }

  // Number citations in reading order: Overview first, then the tabs in their order (spec 4.2).
  const ordered: Section[] = [
    ...(out.hook ? [out.hook] : []),
    ...(out.glance ? [out.glance] : []),
    ...out.overview,
    ...(out.curated ? [out.curated] : []),
    ...out.tabs.writing,
    ...out.tabs.sounds,
    ...out.tabs.words,
    ...out.tabs.family,
  ];
  const numbers = new Map<string, ProfileSource>();
  const unknown = new Set<string>();
  for (const s of ordered) {
    eachInline(s.blocks, (n) => {
      if (typeof n === "string") return;
      if (n.t === "unverified") out.unverified++;
      if (n.t !== "cite") return;
      const e = bib.get(n.key);
      if (!e) {
        unknown.add(n.key);
        return;
      }
      let src = numbers.get(n.key);
      if (!src) {
        src = sourceOf(e, numbers.size + 1);
        numbers.set(n.key, src);
      }
      n.n = src.n;
      if (n.loc && !src.locators.includes(n.loc)) src.locators.push(n.loc);
    });
  }
  const listed = Array.isArray(fm.sources) ? fm.sources.map(str).filter((k): k is string => !!k) : [];
  for (const k of listed) if (!bib.has(k)) unknown.add(k);
  if (unknown.size)
    throw new ProfileError(
      `${where}unknown citation key${unknown.size > 1 ? "s" : ""} ${[...unknown].map((k) => `"${k}"`).join(", ")} (not in content/sources.bib)`,
    );
  out.sources = [...numbers.values()];
  return out;
}

function sourceOf(e: BibEntry, n: number): ProfileSource {
  const f = e.fields;
  const author = formatNames(f.author) ?? (f.editor ? `${formatNames(f.editor)} (ed.)` : null);
  const containerParts = [
    f.journal ?? f.booktitle ?? f.series ?? null,
    f.volume ? `vol. ${f.volume}${f.number ? `(${f.number})` : ""}` : null,
    pages(f.pages) ? `pp. ${pages(f.pages)}` : null,
    f.howpublished ?? null,
  ].filter(Boolean);
  return {
    n,
    key: e.key,
    type: e.type,
    author,
    title: f.title ?? null,
    titleInline: f.title ? splitText(f.title) : [],
    year: f.year ?? null,
    container: containerParts.length ? containerParts.join(", ") : null,
    publisher: [f.publisher, f.address].filter(Boolean).join(", ") || null,
    url: f.url ?? (f.doi ? `https://doi.org/${f.doi}` : null),
    doi: f.doi ?? null,
    retrieved: f.urldate ?? null,
    access: accessOf(f.note),
    note: f.note ? noteInline(f.note) : [],
    locators: [],
  };
}

/** Notes are plain prose: only TODO(verify), Arabic script and transcriptions are marked up. */
function noteInline(note: string): Inline[] {
  return parseInline(note.replace(/[*`]/g, (c) => `\\${c}`)).flatMap((n) =>
    // A note is not a place for citations or links: show them as the text they are.
    typeof n !== "string" && n.t === "cite" ? [`@${n.key}`] : typeof n !== "string" && n.t === "link" ? [plainText(n.c)] : [n],
  );
}
