// Profile prose (content/languages/{glottocode}.md) as plain JSON, parsed at build time by
// app/server/profiles.server.ts and rendered by src/shell/inspector/profile/. No Markdown library
// ships to the browser: the client only walks this tree.

export type Inline =
  | string
  | { t: "em" | "strong"; c: Inline[] }
  | { t: "link"; href: string; c: Inline[] }
  | { t: "code"; v: string }
  /** A citation: n is its number in the profile's Sources list (set by buildProfile). */
  | { t: "cite"; key: string; loc: string | null; n: number }
  /** A TODO(verify) marker in the source text: the claim around it is not verified yet. */
  | { t: "unverified" }
  /** Arabic-script text, rendered with lang="fa" dir="rtl" (see markdown.ts, splitText). */
  | { t: "fa"; v: string }
  /** A phonetic [..] or phonemic /../ transcription, rendered with lang="und-fonipa". */
  | { t: "ipa"; v: string }
  | { t: "br" };

export type Block =
  | { t: "h"; level: number; id: string; c: Inline[] }
  | { t: "p"; c: Inline[] }
  | { t: "list"; ordered: boolean; start: number; items: Block[][] }
  | { t: "table"; head: Inline[][]; rows: Inline[][][] }
  | { t: "quote"; c: Block[] }
  | { t: "hr" };

export interface Section {
  /** The H2 text as written (plain). */
  title: string;
  id: string;
  /** Blocks under the H2 (the H2 itself is rendered from title and id). */
  blocks: Block[];
}

/** Access status, read from the note of the sources.bib entry. */
export type Access = "opened" | "catalog" | "not-opened" | "unknown";

export interface BibEntry {
  key: string;
  type: string;
  fields: Record<string, string>;
}

export interface ProfileSource {
  n: number;
  key: string;
  type: string;
  author: string | null;
  title: string | null;
  /** The title with Arabic-script runs marked (lang="fa"). */
  titleInline: Inline[];
  year: string | null;
  /** Journal, book, series or howpublished, as one line. */
  container: string | null;
  publisher: string | null;
  url: string | null;
  doi: string | null;
  /** urldate: when the source was retrieved. */
  retrieved: string | null;
  access: Access;
  /** The bib note, parsed for TODO(verify), Arabic script and IPA. */
  note: Inline[];
  /** Locators used for this source in the profile, in first-use order. */
  locators: string[];
}

export type ReviewStatus = { role: string; status: string };

/** Where each part of the profile is shown (docs/specs/app-shell.md 4.1, 4.2; see profile.ts). */
export type ProfileTab = "writing" | "sounds" | "words" | "family";

export interface Profile {
  glottocode: string;
  status: string | null;
  reviews: ReviewStatus[];
  /** status is draft, or any review is not done: show the draft banner. */
  draft: boolean;
  hook: Section | null;
  /** The profile's own "At a glance" notes, shown under the data At a glance. */
  glance: Section | null;
  /** Overview sections after the Why linguists disagree slot, in document order. */
  overview: Section[];
  /** The profile's own Go deeper suggestions. */
  curated: Section | null;
  tabs: Record<ProfileTab, Section[]>;
  sources: ProfileSource[];
  /** Number of TODO(verify) markers rendered as Unverified chips. */
  unverified: number;
}
