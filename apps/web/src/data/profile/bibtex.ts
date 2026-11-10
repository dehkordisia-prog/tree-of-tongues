// A small BibTeX reader for content/sources.bib (build time only): @type{key, field = {value}, ...}
// with braced, quoted or bare values, nested braces, % comment lines and @comment blocks. Values
// are returned with their outer braces removed and inner grouping braces dropped. Duplicate keys
// throw, so a citation can never resolve to the wrong entry.

import type { Access, BibEntry } from "./types.ts";

export class BibError extends Error {}

function lineOf(src: string, at: number): number {
  return src.slice(0, at).split("\n").length;
}

export function parseBibtex(src: string, where = "sources.bib"): Map<string, BibEntry> {
  const out = new Map<string, BibEntry>();
  let i = 0;
  const n = src.length;
  const skipWs = () => {
    while (i < n && /\s/.test(src[i]!)) i++;
  };
  while (i < n) {
    const at = src.indexOf("@", i);
    if (at === -1) break;
    // Only an @ at the start of a line (after spaces) opens an entry; % lines are comments.
    const lineStart = src.lastIndexOf("\n", at - 1) + 1;
    const before = src.slice(lineStart, at);
    if (before.trim() !== "") {
      i = at + 1;
      continue;
    }
    i = at + 1;
    const typeM = /^[A-Za-z]+/.exec(src.slice(i));
    if (!typeM) throw new BibError(`${where}:${lineOf(src, at)}: expected an entry type after @`);
    const type = typeM[0].toLowerCase();
    i += typeM[0].length;
    skipWs();
    const open = src[i];
    if (open !== "{" && open !== "(") throw new BibError(`${where}:${lineOf(src, at)}: expected { after @${type}`);
    const close = open === "{" ? "}" : ")";
    i++;
    if (type === "comment" || type === "preamble" || type === "string") {
      let depth = 1;
      while (i < n && depth > 0) {
        if (src[i] === open) depth++;
        else if (src[i] === close) depth--;
        i++;
      }
      continue;
    }
    skipWs();
    const keyM = /^[^,\s{}()]+/.exec(src.slice(i));
    if (!keyM) throw new BibError(`${where}:${lineOf(src, at)}: entry without a key`);
    const key = keyM[0];
    i += key.length;
    skipWs();
    if (src[i] !== ",") throw new BibError(`${where}:${lineOf(src, at)}: expected , after the key ${key}`);
    i++;
    const fields: Record<string, string> = {};
    for (;;) {
      skipWs();
      if (src[i] === close) {
        i++;
        break;
      }
      if (i >= n) throw new BibError(`${where}:${lineOf(src, at)}: entry ${key} is not closed`);
      const nameM = /^[A-Za-z][\w-]*/.exec(src.slice(i));
      if (!nameM) throw new BibError(`${where}:${lineOf(src, i)}: expected a field name in ${key}`);
      const name = nameM[0].toLowerCase();
      i += nameM[0].length;
      skipWs();
      if (src[i] !== "=") throw new BibError(`${where}:${lineOf(src, i)}: expected = after ${name} in ${key}`);
      i++;
      skipWs();
      let value: string;
      if (src[i] === "{") {
        let depth = 0;
        const s = i;
        for (; i < n; i++) {
          if (src[i] === "\\") {
            i++;
            continue;
          }
          if (src[i] === "{") depth++;
          else if (src[i] === "}" && --depth === 0) break;
        }
        if (i >= n) throw new BibError(`${where}:${lineOf(src, s)}: unclosed { in ${key}.${name}`);
        value = src.slice(s + 1, i);
        i++;
      } else if (src[i] === '"') {
        const s = ++i;
        let depth = 0;
        for (; i < n; i++) {
          if (src[i] === "{") depth++;
          else if (src[i] === "}") depth--;
          else if (src[i] === '"' && depth === 0) break;
        }
        value = src.slice(s, i);
        i++;
      } else {
        const m = /^[^,}\s)]+/.exec(src.slice(i));
        value = m ? m[0] : "";
        i += value.length;
      }
      if (name in fields) throw new BibError(`${where}: ${key} has the field ${name} twice`);
      fields[name] = clean(value);
      skipWs();
      if (src[i] === ",") i++;
    }
    if (out.has(key)) throw new BibError(`${where}:${lineOf(src, at)}: duplicate key ${key}`);
    out.set(key, { key, type, fields });
  }
  return out;
}

/** Drop grouping braces, collapse white space, turn "--" ranges into "to" (house style). */
function clean(v: string): string {
  return v
    .replace(/\\([&%$#_{}])/g, "$1")
    .replace(/[{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** "Last, First and Other, Name" or "{Corporate}" to "First Last and Name Other". */
export function formatNames(v: string | undefined): string | null {
  if (!v) return null;
  const names = v.split(/\s+and\s+/).map((p) => {
    const [last, first] = p.split(/,\s*/, 2);
    return first ? `${first} ${last}` : p;
  });
  if (names.length === 1) return names[0]!;
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

export function pages(v: string | undefined): string | null {
  return v ? v.replace(/\s*-{1,3}\s*/g, " to ") : null;
}

/**
 * Access status from the entry's note. The notes in sources.bib start with what was done:
 * "Checked ...", "Opened ...", "Read ...", "Catalog ...", "Not opened ...", or "Supplied by X. Not opened".
 */
export function accessOf(note: string | undefined): Access {
  if (!note) return "unknown";
  const n = note.trim();
  const lead = n.replace(/^Supplied by [^.:]*[.:]\s*/i, "");
  // What the note starts with wins; a later remark ("the book was not opened") does not override it.
  if (/^Catalog\b/i.test(lead)) return "catalog";
  if (/^Not opened\b/i.test(lead)) return "not-opened";
  if (/^(Checked|Opened|Read)\b/i.test(lead)) return "opened";
  if (/\bcatalog only\b/i.test(n)) return "catalog";
  if (/\bnot opened\b|\bbody not read\b/i.test(n)) return "not-opened";
  if (/\bChecked\b/.test(n)) return "opened";
  return "unknown";
}
