// A small YAML reader for the block-style files in content/ (mappings, sequences, plain and quoted
// scalars, folded multi-line plain scalars, comments, `|` and `>` blocks, empty and simple flow
// collections). It runs at build time only (prerender list and scope index), so the app ships no
// YAML library. Anchors, tags and multi-document streams are not supported and throw.

export type YamlValue = string | number | boolean | null | YamlValue[] | { [key: string]: YamlValue };

interface Line {
  indent: number;
  text: string;
  no: number;
}

function stripComment(s: string): string {
  let quote: string | null = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (quote) {
      if (c === quote) {
        if (quote === "'" && s[i + 1] === "'") i++;
        else quote = null;
      } else if (c === "\\" && quote === '"') i++;
    } else if (c === "'" || c === '"') {
      // A quote only opens a quoted scalar at the start of a value.
      const before = s.slice(0, i).trimEnd();
      if (before === "" || before.endsWith(":") || before.endsWith("-") || before.endsWith("[") || before.endsWith(",")) quote = c;
    } else if (c === "#" && (i === 0 || /\s/.test(s[i - 1]!))) {
      return s.slice(0, i).trimEnd();
    }
  }
  return s.trimEnd();
}

function toLines(src: string): Line[] {
  const out: Line[] = [];
  src.split(/\r?\n/).forEach((raw, no) => {
    if (/^\s*(#.*)?$/.test(raw)) return;
    if (raw.startsWith("---") || raw.startsWith("...")) return;
    if (raw.includes("\t") && /^\t/.test(raw)) throw new Error(`yaml line ${no + 1}: tabs are not allowed for indentation`);
    const indent = raw.length - raw.trimStart().length;
    out.push({ indent, text: raw.slice(indent), no: no + 1 });
  });
  return out;
}

const KEY = /^((?:'(?:[^']|'')*')|(?:"(?:[^"\\]|\\.)*")|(?:[^\s'"#\-?:,[\]{}][^:]*?|-[^\s:][^:]*?))\s*:(?:\s+(.*))?$/;

function unquoteKey(k: string): string {
  if (k.startsWith("'")) return k.slice(1, -1).replace(/''/g, "'");
  if (k.startsWith('"')) return JSON.parse(k) as string;
  return k;
}

function scalar(raw: string): YamlValue {
  const s = raw.trim();
  if (s === "" || s === "~" || s === "null" || s === "Null" || s === "NULL") return null;
  if (s === "true" || s === "True") return true;
  if (s === "false" || s === "False") return false;
  if (/^[-+]?\d+$/.test(s)) return Number(s);
  if (/^[-+]?(\d+\.\d*|\.\d+|\d+)([eE][-+]?\d+)?$/.test(s)) return Number(s);
  if (s.startsWith("'") && s.endsWith("'") && s.length >= 2) return s.slice(1, -1).replace(/''/g, "'");
  if (s.startsWith('"') && s.endsWith('"') && s.length >= 2) return JSON.parse(s.replace(/\n/g, "\\n")) as string;
  if (s.startsWith("[") && s.endsWith("]")) {
    const inner = s.slice(1, -1).trim();
    return inner === "" ? [] : splitFlow(inner).map(scalar);
  }
  if (s === "{}") return {};
  if (s.startsWith("&") || s.startsWith("*") || s.startsWith("!")) throw new Error(`yaml: anchors and tags are not supported: ${s}`);
  return s;
}

function splitFlow(s: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quote: string | null = null;
  for (const c of s) {
    if (quote) {
      cur += c;
      if (c === quote) quote = null;
    } else if (c === "'" || c === '"') {
      quote = c;
      cur += c;
    } else if (c === ",") {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out.map((x) => x.trim());
}

class Parser {
  i = 0;
  private readonly lines: Line[];
  constructor(lines: Line[]) {
    this.lines = lines;
  }

  peek(): Line | undefined {
    return this.lines[this.i];
  }

  block(indent: number): YamlValue {
    const line = this.peek();
    if (!line || line.indent < indent) return null;
    return isSeq(line.text) ? this.seq(line.indent) : this.map(line.indent);
  }

  seq(indent: number): YamlValue[] {
    const out: YamlValue[] = [];
    for (let line = this.peek(); line && line.indent === indent && isSeq(line.text); line = this.peek()) {
      const rest = line.text === "-" ? "" : line.text.slice(2);
      const restTrim = rest.trimStart();
      if (restTrim === "") {
        this.i++;
        const next = this.peek();
        out.push(next && next.indent > indent ? this.block(next.indent) : null);
        continue;
      }
      const offset = indent + 2 + (rest.length - restTrim.length);
      // Re-read the item content as a line of its own at the content's column.
      this.lines[this.i] = { indent: offset, text: restTrim, no: line.no };
      if (isSeq(restTrim) || KEY.test(stripComment(restTrim))) out.push(this.block(offset));
      else out.push(this.plain(restTrim, indent));
    }
    return out;
  }

  map(indent: number): { [key: string]: YamlValue } {
    const out: { [key: string]: YamlValue } = {};
    for (let line = this.peek(); line && line.indent === indent && !isSeq(line.text); line = this.peek()) {
      const text = stripComment(line.text);
      const m = KEY.exec(text);
      if (!m) throw new Error(`yaml line ${line.no}: expected "key: value", got ${JSON.stringify(line.text)}`);
      const key = unquoteKey(m[1]!);
      const rest = m[2] ?? "";
      if (rest === "") {
        this.i++;
        const next = this.peek();
        if (next && next.indent > indent) out[key] = this.block(next.indent);
        else if (next && next.indent === indent && isSeq(next.text)) out[key] = this.seq(indent);
        else out[key] = null;
      } else if (rest === "|" || rest === ">" || rest === "|-" || rest === ">-") {
        this.i++;
        out[key] = this.literal(indent, rest);
      } else {
        out[key] = this.plain(rest, indent);
      }
    }
    return out;
  }

  /** A scalar that may continue on more-indented lines (folded with spaces). */
  plain(first: string, parentIndent: number): YamlValue {
    this.i++;
    let text = stripComment(first);
    const quoted = text.startsWith("'") || text.startsWith('"');
    while (true) {
      const next = this.peek();
      if (!next || next.indent <= parentIndent) break;
      if (!quoted && (isSeq(next.text) || KEY.test(stripComment(next.text)))) break;
      text += " " + stripComment(next.text.trim());
      this.i++;
    }
    return scalar(text);
  }

  literal(indent: number, style: string): string {
    const parts: string[] = [];
    let base = -1;
    for (let line = this.peek(); line && line.indent > indent; line = this.peek()) {
      if (base < 0) base = line.indent;
      parts.push(" ".repeat(line.indent - base) + line.text);
      this.i++;
    }
    const joined = style.startsWith("|") ? parts.join("\n") : parts.join(" ");
    return style.endsWith("-") ? joined : joined + "\n";
  }
}

function isSeq(text: string): boolean {
  return text === "-" || text.startsWith("- ");
}

export function parseYaml(src: string): YamlValue {
  const lines = toLines(src);
  const p = new Parser(lines);
  const value = p.block(0);
  if (p.i < lines.length) throw new Error(`yaml line ${lines[p.i]!.no}: unexpected indentation`);
  return value;
}
