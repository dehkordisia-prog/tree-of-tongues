// A small Markdown reader for the profiles in content/languages/ (build time only). It covers what
// the profiles use: ATX headings, paragraphs, bullet and numbered lists (with indented continuation
// and nesting), pipe tables, blockquotes, horizontal rules, emphasis, strong, inline code and links.
// On top of Markdown it reads the house conventions:
//   [@key], [@key, locator], [@a; @b], [@key, s.v. x; s.v. y]   citations (Pandoc style)
//   TODO(verify)                                               an unverified claim
//   [ipa] that is not a link or a citation, and /ipa/          transcriptions
//   runs of Arabic script                                      Persian spans (lang="fa", dir="rtl")
// HTML comments are dropped. Anything else is kept as text (React escapes it).

import type { Block, Inline } from "./types.ts";

export class MarkdownError extends Error {}

/* ------------------------------------------------------------------ inline */

const ARABIC = "\\u0600-\\u06FF\\u0750-\\u077F\\u08A0-\\u08FF\\uFB50-\\uFDFF\\uFE70-\\uFEFF";
// One span per run of Arabic-script words: spaces and ZWNJ between Arabic letters stay inside it.
const ARABIC_RUN = new RegExp(`[${ARABIC}](?:[${ARABIC}\\u200c\\u200f \\t]*[${ARABIC}])?`, "g");
// Phonemic transcription between slashes, standing alone: " /æ e o/ " but not "s/he" or "1/11/1928".
const SLASH_IPA = /(^|[\s(])(\/[^\s/][^/\n]{0,40}?\/)(?=$|[\s),.;:!?])/g;
const TODO = "TODO(verify)";
const CITE_KEY = /^@([A-Za-z0-9_:-]+)\s*(?:,\s*([\s\S]*))?$/;

/** Text leaf: split out Arabic-script runs and slash transcriptions. */
export function splitText(s: string): Inline[] {
  const marks: { start: number; end: number; node: Inline }[] = [];
  for (const m of s.matchAll(ARABIC_RUN)) {
    marks.push({ start: m.index, end: m.index + m[0].length, node: { t: "fa", v: m[0] } });
  }
  for (const m of s.matchAll(SLASH_IPA)) {
    const start = m.index + m[1]!.length;
    const v = m[2]!;
    if (/^\/[\d\s.,]+\/$/.test(v)) continue;
    if (marks.some((x) => start < x.end && start + v.length > x.start)) continue;
    marks.push({ start, end: start + v.length, node: { t: "ipa", v } });
  }
  if (!marks.length) return s ? [s] : [];
  marks.sort((a, b) => a.start - b.start);
  const out: Inline[] = [];
  let at = 0;
  for (const x of marks) {
    if (x.start > at) out.push(s.slice(at, x.start));
    out.push(x.node);
    at = x.end;
  }
  if (at < s.length) out.push(s.slice(at));
  return out;
}

/** Index of the bracket that closes the one at `open`, or -1. */
function closeOf(s: string, open: number, o: string, c: string): number {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === "\\") {
      i++;
      continue;
    }
    if (s[i] === o) depth++;
    else if (s[i] === c && --depth === 0) return i;
  }
  return -1;
}

/** "[@a, p. 3; @b; s.v. x]" inner text to citations. A part without @ continues the previous locator. */
export function parseCitations(inner: string, where = ""): Extract<Inline, { t: "cite" }>[] {
  const out: Extract<Inline, { t: "cite" }>[] = [];
  for (const raw of inner.split(";")) {
    const part = raw.trim();
    if (!part) continue;
    const m = CITE_KEY.exec(part);
    if (m) {
      out.push({ t: "cite", key: m[1]!, loc: m[2]?.trim() || null, n: 0 });
    } else if (part.startsWith("@")) {
      throw new MarkdownError(`${where}malformed citation "[${inner}]"`);
    } else {
      const prev = out.at(-1);
      if (!prev) throw new MarkdownError(`${where}citation without a key: "[${inner}]"`);
      prev.loc = prev.loc ? `${prev.loc}; ${part}` : part;
    }
  }
  return out;
}

function isWordChar(c: string | undefined): boolean {
  return !!c && /[\p{L}\p{N}]/u.test(c);
}

export function parseInline(src: string, where = ""): Inline[] {
  const out: Inline[] = [];
  let buf = "";
  const flush = () => {
    if (buf) out.push(...splitText(buf));
    buf = "";
  };
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    if (src.startsWith(TODO, i)) {
      flush();
      out.push({ t: "unverified" });
      i += TODO.length;
      if (src[i] === ":") i++; // "TODO(verify): what is open" reads as "[Unverified] what is open"
      continue;
    }
    if (c === "\\" && i + 1 < src.length && /[\\`*_[\]()#+\-.!|>]/.test(src[i + 1]!)) {
      buf += src[i + 1];
      i += 2;
      continue;
    }
    if (c === "`") {
      const j = src.indexOf("`", i + 1);
      if (j > i) {
        flush();
        out.push({ t: "code", v: src.slice(i + 1, j) });
        i = j + 1;
        continue;
      }
    }
    if (c === "[") {
      const j = closeOf(src, i, "[", "]");
      if (j > i) {
        const inner = src.slice(i + 1, j);
        if (/^\s*@/.test(inner)) {
          flush();
          out.push(...parseCitations(inner, where));
          i = j + 1;
          continue;
        }
        if (src[j + 1] === "(") {
          const k = closeOf(src, j + 1, "(", ")");
          if (k > j) {
            flush();
            out.push({ t: "link", href: src.slice(j + 2, k).trim(), c: parseInline(inner, where) });
            i = k + 1;
            continue;
          }
        }
        if (inner.trim() && !inner.includes("[")) {
          flush();
          out.push({ t: "ipa", v: `[${inner}]` });
          i = j + 1;
          continue;
        }
      }
    }
    if (c === "*") {
      if (src.startsWith("**", i)) {
        const j = src.indexOf("**", i + 2);
        if (j > i + 2) {
          flush();
          out.push({ t: "strong", c: parseInline(src.slice(i + 2, j), where) });
          i = j + 2;
          continue;
        }
      } else if (src[i + 1] && !/\s/.test(src[i + 1]!)) {
        // Emphasis: *x* with no space inside the stars and no letter right after the closing one.
        let j = i + 1;
        while ((j = src.indexOf("*", j)) !== -1) {
          if (src[j + 1] === "*") {
            j += 2;
            continue;
          }
          if (!/\s/.test(src[j - 1]!) && !isWordChar(src[j + 1])) break;
          j++;
        }
        if (j > i + 1) {
          flush();
          out.push({ t: "em", c: parseInline(src.slice(i + 1, j), where) });
          i = j + 1;
          continue;
        }
      }
    }
    buf += c;
    i++;
  }
  flush();
  return out;
}

/* ------------------------------------------------------------------ blocks */

const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const HR = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/;
const BULLET = /^(\s*)([-*+])\s+(.*)$/;
const ORDERED = /^(\s*)(\d{1,9})[.)]\s+(.*)$/;
const TABLE_SEP = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/;

export function stripComments(md: string, where = ""): string {
  const out = md.replace(/<!--[\s\S]*?-->/g, "");
  if (out.includes("<!--")) throw new MarkdownError(`${where}unclosed HTML comment`);
  return out;
}

export function slug(s: string): string {
  return (
    s
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "section"
  );
}

/** Plain text of inline nodes (headings, ids, aria labels). */
export function plainText(nodes: Inline[]): string {
  return nodes
    .map((n) =>
      typeof n === "string"
        ? n
        : n.t === "em" || n.t === "strong" || n.t === "link"
          ? plainText(n.c)
          : n.t === "code" || n.t === "fa" || n.t === "ipa"
            ? n.v
            : "",
    )
    .join("");
}

function cells(line: string): string[] {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|") && !s.endsWith("\\|")) s = s.slice(0, -1);
  const out: string[] = [];
  let cur = "";
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (c === "\\" && s[i + 1] === "|") {
      cur += "|";
      i++;
      continue;
    }
    if (c === "[" || c === "(") depth++;
    if ((c === "]" || c === ")") && depth > 0) depth--;
    if (c === "|" && depth === 0) {
      out.push(cur.trim());
      cur = "";
    } else cur += c;
  }
  out.push(cur.trim());
  return out;
}

const indentOf = (l: string) => l.length - l.trimStart().length;

export interface BlockOptions {
  /** Prefix for error messages, for example "content/languages/x.md: ". */
  where?: string;
  /** Keep line breaks inside paragraphs (blockquotes: verse). */
  breaks?: boolean;
}

export function parseBlocks(md: string, opts: BlockOptions = {}): Block[] {
  const where = opts.where ?? "";
  const lines = md.replace(/\r\n?/g, "\n").replace(/\t/g, "    ").split("\n");
  const blocks: Block[] = [];
  const startsBlock = (l: string) =>
    HEADING.test(l) || HR.test(l) || /^\s{0,3}>/.test(l) || BULLET.test(l) || ORDERED.test(l) || l.trimStart().startsWith("|");
  const inlineJoin = (ls: string[]): Inline[] => {
    if (!opts.breaks) return parseInline(ls.map((l) => l.trim()).join(" "), where);
    const out: Inline[] = [];
    ls.forEach((l, k) => {
      if (k > 0) out.push({ t: "br" });
      out.push(...parseInline(l.trim(), where));
    });
    return out;
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (!line.trim()) {
      i++;
      continue;
    }
    const h = HEADING.exec(line);
    if (h && indentOf(line) < 4) {
      const c = parseInline(h[2]!, where);
      blocks.push({ t: "h", level: h[1]!.length, id: slug(plainText(c)), c });
      i++;
      continue;
    }
    if (HR.test(line)) {
      blocks.push({ t: "hr" });
      i++;
      continue;
    }
    if (/^\s{0,3}>/.test(line)) {
      const body: string[] = [];
      while (i < lines.length && /^\s{0,3}>/.test(lines[i]!)) {
        body.push(lines[i]!.replace(/^\s{0,3}>\s?/, ""));
        i++;
      }
      blocks.push({ t: "quote", c: parseBlocks(body.join("\n"), { where, breaks: true }) });
      continue;
    }
    if (line.trimStart().startsWith("|") && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1]!)) {
      const head = cells(line).map((x) => parseInline(x, where));
      i += 2;
      const rows: Inline[][][] = [];
      while (i < lines.length && lines[i]!.trimStart().startsWith("|")) {
        const r = cells(lines[i]!).map((x) => parseInline(x, where));
        while (r.length < head.length) r.push([]);
        rows.push(r.slice(0, Math.max(head.length, r.length)));
        i++;
      }
      blocks.push({ t: "table", head, rows });
      continue;
    }
    const marker = BULLET.exec(line) ?? ORDERED.exec(line);
    if (marker) {
      const ordered = !BULLET.test(line);
      const base = marker[1]!.length;
      const items: Block[][] = [];
      let start = ordered ? Number(marker[2]) : 1;
      if (!Number.isFinite(start)) start = 1;
      while (i < lines.length) {
        const m = (ordered ? ORDERED : BULLET).exec(lines[i]!);
        if (!m || m[1]!.length !== base) break;
        const contentIndent = base + m[2]!.length + 1;
        const body: string[] = [m[3]!];
        i++;
        // Continuation: indented lines (blank lines allowed between them), or lazy lines of the
        // first paragraph that do not start another block.
        while (i < lines.length) {
          const l = lines[i]!;
          if (!l.trim()) {
            let k = i + 1;
            while (k < lines.length && !lines[k]!.trim()) k++;
            if (k < lines.length && indentOf(lines[k]!) >= contentIndent - 1 && indentOf(lines[k]!) > base) {
              for (; i < k; i++) body.push("");
              continue;
            }
            break;
          }
          if (indentOf(l) > base) {
            body.push(l.slice(Math.min(indentOf(l), contentIndent)));
            i++;
            continue;
          }
          if (!startsBlock(l) && body.at(-1)?.trim()) {
            body.push(l.trim());
            i++;
            continue;
          }
          break;
        }
        items.push(parseBlocks(body.join("\n"), { where }));
        // A blank line between items keeps the list going.
        let k = i;
        while (k < lines.length && !lines[k]!.trim()) k++;
        const next = k < lines.length ? (ordered ? ORDERED : BULLET).exec(lines[k]!) : null;
        if (next && next[1]!.length === base) i = k;
        else break;
      }
      blocks.push({ t: "list", ordered, start, items });
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i]!.trim() && (para.length === 0 || !startsBlock(lines[i]!))) {
      para.push(lines[i]!);
      i++;
    }
    blocks.push({ t: "p", c: inlineJoin(para) });
  }
  return blocks;
}

/** Split "---\nyaml\n---\nbody" into its two parts. */
export function splitFrontmatter(md: string): { yaml: string | null; body: string } {
  const m = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(md);
  if (!m) return { yaml: null, body: md };
  return { yaml: m[1]!, body: md.slice(m[0].length) };
}
