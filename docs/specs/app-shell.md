# App shell spec (Phase 1)

Status: provisional. Written by ux-designer on 2026-11-10 for Phase 1, step 3 (docs/plans/phase-1.md). Not reviewed by the owner. Decisions marked **(P)** are provisional and should be logged in docs/DECISIONS.md by the orchestrator.

Builders: viz-engineer (shell, store, tree), cartographer (map lens), audio-engineer (Sounds tab), script-typographer (RTL, fonts). Verifier: qa-gatekeeper.

Reads with: docs/SPEC.md (sections 1, 3, 4, 5, 7, 8), docs/DESIGN.md (tokens, motion, component inventory), docs/plans/phase-1.md, D-004, D-005, D-019, D-021.

Legend used below:
- **Phase 1**: build now.
- **Later (Phase N)**: do not build; leave the slot, the type or the parameter name reserved.
- **(P)**: a provisional decision this spec makes.

---

## 0. What the spikes taught us

| Spike finding | Shell consequence |
| --- | --- |
| Tree spike writes `?focus=` with `replaceState` outside React Router | Replaced by the store and URL sync in section 3. Camera writes go through one module. |
| Tree keyboard (arrows, Enter, Esc, Backspace, Home, +, -) and the "Inside X" list work well | Kept as is. The list becomes the canvas text alternative for both lenses. |
| Circle packing wastes space; a language is about 0.2 px at the world view | Layout is viz-engineer's call (plan step 4). The shell only fixes the bubble glyph (section 5) and the camera contract (section 2.4). |
| Map spike puts search, country picker, legend and panel in one page | Search moves to the command palette. The country picker becomes a search group. The panel becomes the Inspector. |
| The spike `TimeSlider` is a live range input with "No data for this period" | Phase 1 shows a static, inactive slider (section 1.6). |
| `west2369` and the Persian Wikidata item disagree; Persian figures sit on `fars1254`; `west2369` has no speakers and no territories | Macrolanguages get their own entity type and route (section 6). Data-curator must move the `fas` figures and CLDR rows there. |
| Wikidata speaker rows: 1,894 of 2,413 have kind "unknown"; 790 have no reference | The Speakers display has an explicit "kind not stated" group and a "no reference in Wikidata" label (section 5). |
| `?lang` is session-sticky through `LocaleSync` | Locale moves into the URL contract (section 2.6). |

---

## 1. Information architecture

### 1.1 The one canvas
One persistent layout route owns a single world canvas. The canvas has lenses. Entity routes change what is selected; they never remount the canvas.

| Lens | Phase | What it draws |
| --- | --- | --- |
| Tree | 1 | Genealogy (Glottolog 5.3). Families as nested regions, languages as speaker bubbles (section 5). |
| Map | 1 | Present-day geography. Glottolog points, CLDR country shares, borders policy D-019. |
| Time | Later (Phase 2) | The language river. Its place in the lens switcher is reserved as the third position. Not rendered in Phase 1. |

Lens rules:
- The selection survives every lens switch.
- Each lens keeps its own camera. Switching back restores it.
- **(P)** Each lens mounts on first use and then stays mounted, paused (no animation frame loop) while hidden. qa-gatekeeper checks the 500 MB memory budget with both mounted. If it fails, unmount the hidden lens after 60 s.

### 1.2 Regions of the shell

| Region | Landmark | Contents |
| --- | --- | --- |
| Top bar | `header` (banner) | Wordmark (link to `/`), Search button, Lens switcher, Settings menu |
| Breadcrumbs | `nav` "Path" | Genealogical path of the selection |
| Canvas | `main` | Active lens canvas, its overlays (text list, legend, zoom controls), the Time slider |
| Inspector | `aside` (complementary) | The selected entity, or the welcome panel |
| Footer strip | inside `main`, bottom | Borders note (map lens), "Sources and credits" |
| Command palette | `dialog` (modal) | Global search |

### 1.3 Inspector
- Desktop (1024 px and up): right panel (inline-end, so left in Persian), width `clamp(360px, 30vw, 440px)`, full height below the top bar, `shadow-overlay`. A collapse button hides it to a 44 px rail; the rail button reopens it. Collapse state is session-only, not in the URL.
- Below 1024 px: bottom sheet with three stops (section 8.4): peek, half, full.
- With no selection, the Inspector shows the welcome panel (section 4.5). It is never blank.

### 1.4 Global search
- A visible Search button in the top bar, labeled "Search" with the shortcut hint "Ctrl K" (or "⌘ K" on Apple platforms).
- Ctrl+K or Cmd+K opens the command palette from anywhere, including inside text fields.
- Details in section 7.

### 1.5 Lens switcher
- A radio group of two options, Tree and Map, each with an icon and a visible label, each at least 44 x 44 px.
- Arrow keys move and select (native radio behavior). Left and Right mirror in Persian.
- The reserved third slot (Time) is not rendered in Phase 1. No disabled radio.

### 1.6 Time slider (inactive in Phase 1)
- Always visible. Desktop: a 56 px strip at the bottom of the canvas column, under the canvas. Phone: a 44 px strip directly above the Inspector peek.
- **(P)** In Phase 1 it is not an input. It is a labeled group: the label "Year", the value "Today", a decorative track with the thumb at the present end, and one line of text: "Time travel comes in a later update. Everything shows today's data."
- Why not a disabled range input: disabled inputs drop out of the tab order and give screen-reader users a control that does nothing. Static text tells everyone the same thing.
- The track mirrors in Persian (present at the inline-end, so on the left).
- Later (Phase 2): becomes the real scrubber (DESIGN.md: arrows step, Page keys jump a century, BCE and CE labels).

### 1.7 Breadcrumbs
- The Glottolog lineage of the selection, root first: "World", then every ancestor, then the selection (`aria-current="page"`).
- Lumped macrolanguage (section 6): the macrolanguage appears as a crumb between the lowest common ancestor and the member.
- Country selection: "World", then the country.
- Collapse: show "World", the first family, a "more" button, the last two ancestors and the current item. The "more" button opens a menu with the hidden crumbs. On phones: the "more" button, the parent and the current item.
- Each crumb is a 44 px target. Selecting a crumb navigates (push) and flies the camera out.
- Separators are chevrons that mirror in Persian, `aria-hidden`.

### 1.8 Settings menu (top bar)
- Theme: System, Night, Parchment (existing `ThemeToggle`).
- Interface language: English, فارسی, Türkçe (endonyms, existing `LOCALE_ENDONYMS`).
- **(P)** Motion: Follow system, Reduced. Saved in `localStorage["tt-motion"]`; sets `data-motion="reduce"` on `<html>`.
- Keyboard shortcuts: opens the help dialog (section 9.4).
- Later: Sound (one global mute, Phase 2 with UI sounds), Size metric and Color by (Phase 2), Classification lens (section 2.3).

---

## 2. Routes and the URL

The URL is the source of truth for everything a reader would want to share. The store mirrors it (section 3).

### 2.1 Routes

| Path | Entity | Phase | Default lens | Prerendered |
| --- | --- | --- | --- | --- |
| `/` | None (world view) | 1 | Tree | Yes |
| `/language/:glottocode` | A languoid at level language or dialect | 1 | Tree | The 100 scope languages (content/scope/phase-1-languages.yaml) |
| `/family/:glottocode` | A languoid at level family | 1 | Tree | Every ancestor of the 100 scope languages |
| `/macrolanguage/:iso` | An ISO 639-3 macrolanguage (`ara`, `zho`, `fas`) | 1 **(P)** | Tree | The three in the Lumper/Splitter set |
| `/country/:iso` | A country or territory, ISO 3166-1 alpha-2 in lower case (CLDR territory code), for example `/country/ir` | 1, should-have **(P)** | Map | Yes, if it ships: every territory with its own polygon (D-019 rule 3) |
| `/word/:id`, `/sound/:ipa`, `/script/:iso15924`, `/event/:id`, `/trail/:slug` | | Later (Phases 2 to 4) | | |

Route rules:
- All entity routes are children of one layout route (`routes/shell.tsx`) that owns the canvas, so the canvas never remounts on navigation.
- Any Glottocode with a bundle works at runtime, prerendered or not (SPA fallback). This is how search reaches all 27,177 languoids.
- Level mismatch: `/language/indo1319` (a family) redirects with replace to `/family/indo1319`, and the reverse. Query is kept.
- Unknown code: the route shows the not-found state (section 4.7). No redirect.
- Disputed and breakaway areas have no route. They stay selectable on the map through `?area=` (section 2.2) so D-019 holds: they are never presented like a country page.
- `/design` stays. The `/spike/*` routes are removed when the production lenses pass the Phase 1 gate (orchestrator's call).

**(P)** Why `/macrolanguage/:iso`: a macrolanguage is not a Glottolog languoid, so it has no Glottocode (D-001). ISO 639-3 is the authority that defines macrolanguages, so its code is the stable key.

### 2.2 Query parameters
Defaults are omitted, so the canonical URL is the shortest one. Parameters are written in this order.

| Param | Values | Default | Phase | Meaning |
| --- | --- | --- | --- | --- |
| `lens` | `tree`, `map` | Route default (2.1) | 1 | Active lens. `time` reserved for Phase 2. |
| `tab` | Per entity type, see section 4 | `overview` | 1 | Inspector tab. |
| `lump` | Comma list of ISO 639-3 macrolanguage codes, sorted: `ara`, `fas`, `zho` | Empty (split, the Glottolog view) | 1 | Macrolanguages shown grouped (section 6). |
| `class` | `glottolog` | `glottolog` | 1 (one value) | Classification lens. `traditional` reserved, later. |
| `year` | Signed integer, `-520` = 520 BCE, `1928` = 1928 CE, `0` invalid | Absent (today) | Later (Phase 2) | Phase 1 strips it with replace and shows the slider message. |
| `area` | Natural Earth neutral-area id from the map data | Absent | 1 | Selected disputed or breakaway area. Only on `/` with `lens=map`. |
| `dialects` | `1` | Absent | 1 | Map shows dialect points. |
| `tz` | Number, 2 decimals | Absent (fit) | 1 | Tree zoom, log2 relative to fitting the selection. `1` = twice as close. |
| `tc` | `dx,dy`, 2 decimals each | Absent (centered) | 1 | Tree center offset from the selection's center, in multiples of its radius. |
| `map` | `zoom/lat/lon`, 2, 3 and 3 decimals, for example `4.20/32.900/53.300` | Absent (fit) | 1 | Map camera, in the familiar OpenStreetMap order. |
| `lang` | `fa`, `tr` | Absent (English) | 1 | Interface language. |

Rules:
- Invalid values are dropped and the URL is rewritten with replace to its canonical form. Unknown params are dropped, except developer flags (`bench`, `stress`, `renderer`) in dev builds.
- **(P)** Tree camera is relative to the selection, not in world units. Layouts will change between builds (plan step 4 tests new layouts), and world coordinates would break old links. Relative zoom also scales with the viewport, so a link made on a laptop frames the same thing on a phone.
- With no selection, `tz` and `tc` are relative to the root.
- `map` is absolute (standard for maps). A phone shows a smaller area for the same link. Accepted.

Examples:
```text
/language/west2369
/language/west2369?tab=speakers&lang=fa
/family/turk1311?tz=1.50&tc=0.10,-0.20
/language/west2369?lens=map&map=4.20/32.900/53.300
/macrolanguage/fas?lump=fas
/country/ir
/?lens=map&area=ne-kashmir&dialects=1
```

### 2.3 Classification lens
- Phase 1 ships Glottolog only (D-002). The legend states "Classification: Glottolog 5.3" with a citation chip. No control.
- Later: a "Classification" control in Settings with Glottolog and Traditional groupings, always labeled. `class=traditional` is reserved.

### 2.4 History: what pushes, what replaces

| Change | History | Notes |
| --- | --- | --- |
| Selection (path change): click, Enter, search result, crumb, Go deeper card, Esc to parent | Push | Before pushing, flush any pending camera write into the current entry, so Back lands on the exact old camera. |
| Lens switch | Push | Back returns to the other lens. |
| Lump or split a macrolanguage | Push | It changes the shape of the tree. |
| Inspector tab | Replace | Tabs are not places. |
| Camera (pan, zoom, pinch, wheel, end of a flight away from the default fit) | Replace, debounced (section 3.3) | Never push. |
| Map dialects toggle | Replace | |
| Interface language | Replace | See 2.6. |
| Canonicalization (invalid params, level mismatch) | Replace | |

Back and forward:
- Restore selection, lens, tab, lump and both cameras from the URL.
- The camera flies to the restored state with `flightDuration(levels crossed)`. Reduced motion: 200 ms crossfade.
- If the restored URL has no camera params, the camera fits the selection.
- Focus does not move on back or forward. The live region announces the restored selection.

### 2.5 What a shared link restores
Restored: selection, lens, tab, lumped macrolanguages, tree camera, map camera, map dialects, map area, interface language.

Not restored (personal, stored locally): theme, motion setting, Inspector collapsed or sheet stop, palette state, keyboard cursor.

On phones, a shared link with a selection opens the sheet at the peek stop, so the canvas stays visible.

### 2.6 Locale
- **(P)** `?lang` is honored on page load and whenever the reader picks a language. In-app links carry it (one `useShellHref()` helper builds every link).
- **(P)** Back and forward keep the current interface language. If the restored entry has a different `lang`, the shell rewrites it with replace. Otherwise switching to Persian and pressing Back would flip the interface to English.
- This replaces the session-sticky behavior in `src/i18n/LocaleSync.tsx`.
- Prerendered HTML is English. Later: prerendered `/fa/` and `/tr/` trees (decide with the owner).

### 2.7 Prerendering
- Prerendered: `/`, the 100 scope languages, their ancestor families, the three macrolanguages, and countries if the country route ships.
- Each prerendered page contains, without JavaScript: `<title>`, meta description, the h1 name and endonym, the At a glance block with citations, the Sources list, and the Go deeper links as real `<a href>`.
- The canvas is never prerendered. It starts on the client, lazily, as in the spikes.
- Title format: "{Name}, {level} · Tree of Tongues", for example "Turkish, language · Tree of Tongues".
- Engineering check: confirm with Context7 how React Router 8.5 combines a build-time `loader` on prerendered paths with a `clientLoader` for the SPA-fallback paths of the same dynamic route. If they cannot share a route, keep `clientLoader` only and generate the static HTML block from the bundle in a build script.

---

## 3. Store (Zustand) and URL sync

### 3.1 Principle
- Data flows one way for URL-backed fields: URL to store. Actions that change a URL-backed field build the next URL and call `navigate()`. The location listener then updates the store. No field is written in two places.
- Entity data (bundles) is not in the store. Route loaders fetch it (`/data/bundles/{glottocode}.json`, macrolanguage and country files from data-curator). **(P)**
- Live camera state stays inside each lens controller at 60 fps. The store receives only settled cameras.

### 3.2 Shape

```ts
// apps/web/src/state/shell.ts
export type Lens = "tree" | "map";                    // "time" reserved, Phase 2
export type MacroCode = "ara" | "fas" | "zho";        // scope from content/scope; extend there
export type Selection =
  | { kind: "language"; glottocode: string }          // level language or dialect
  | { kind: "family"; glottocode: string }
  | { kind: "macrolanguage"; iso: MacroCode }
  | { kind: "country"; iso: string }                  // lower-case alpha-2
  | null;                                             // world view
export type LanguageTab = "overview" | "speakers" | "where" | "writing" | "sounds" | "words" | "family" | "sources";
export type FamilyTab = "overview" | "members" | "where" | "sources";
export type MacroTab = "overview" | "speakers" | "where" | "sources";
export type CountryTab = "languages" | "sources";
export type TreeCamera = { tz: number; dx: number; dy: number };   // relative to the selection
export type MapCamera = { zoom: number; lat: number; lon: number };
export type SheetStop = "peek" | "half" | "full";

export interface UrlState {                           // parseShellUrl(location) <-> toShellHref(state)
  selection: Selection;
  lens: Lens;
  tab: LanguageTab | FamilyTab | MacroTab | CountryTab;
  lumped: readonly MacroCode[];                       // sorted, unique
  classification: "glottolog";
  year: null;                                         // Phase 2: number | null
  area: string | null;
  mapDialects: boolean;
  treeCamera: TreeCamera | null;                      // null = fit the selection
  mapCamera: MapCamera | null;                        // null = fit the selection
  locale: Locale;                                     // "en" | "fa" | "tr"
}

export interface SessionState {                       // never in the URL
  inspectorCollapsed: boolean;                        // desktop
  sheetStop: SheetStop;                               // phone
  paletteOpen: boolean;
  paletteQuery: string;
  treeCursor: string | null;                          // keyboard cursor glottocode
  flight: { lens: Lens; running: boolean } | null;
  mounted: { tree: boolean; map: boolean };
  announcement: { text: string; id: number };         // id forces re-announcement of equal text
  helpOpen: boolean;
}

export interface ShellStore extends UrlState, SessionState {
  // URL-backed actions: each computes the next UrlState and navigates.
  select(sel: Selection, opts?: { tab?: UrlState["tab"]; lens?: Lens }): void;   // push
  setLens(lens: Lens): void;                                                    // push
  setTab(tab: UrlState["tab"]): void;                                           // replace
  setLumped(code: MacroCode, lumped: boolean): void;                            // push
  setMapDialects(on: boolean): void;                                            // replace
  setLocale(locale: Locale): void;                                              // replace
  commitCamera(lens: Lens, cam: TreeCamera | MapCamera | null): void;           // debounced replace
  flushCamera(): void;                                                          // before any push
  // Called only by <UrlSync>.
  hydrateFromUrl(next: UrlState, cause: "load" | "push" | "replace" | "pop"): void;
  // Session actions.
  setSheetStop(stop: SheetStop): void;
  toggleInspector(): void;
  openPalette(query?: string): void;
  closePalette(): void;
  setTreeCursor(g: string | null): void;
  announce(text: string): void;
}
```

Files (ARCHITECTURE.md layout):
- `src/state/url.ts`: `parseShellUrl`, `toShellHref`, `canonicalize`. Pure. Round-trip tested.
- `src/state/shell.ts`: the vanilla store (`createStore`) plus `useShell(selector)`.
- `src/state/UrlSync.tsx`: listens to `useLocation()` and `useNavigationType()`, calls `hydrateFromUrl`, applies the locale rule from 2.6, and canonicalizes with replace.
- `src/state/useShellHref.ts`: builds hrefs that keep `lens`, `lump`, `lang` and drop camera params (a new selection gets a fresh fit).

### 3.3 Camera debounce rules
- A lens controller calls `commitCamera` when the camera settles: pointer up, wheel idle for 150 ms, or a flight ends.
- The store writes the URL with replace 400 ms after the last `commitCamera`, and at most once per 1,000 ms during long interactions.
- No write while a flight runs or a pointer is down.
- If the settled camera equals the default fit (within 0.05 in `tz`, 0.02 in `dx` and `dy`, or 0.05 zoom and 0.001 degree on the map), the param is removed instead.
- `flushCamera()` runs synchronously before every push (2.4), so the old entry keeps its exact camera.
- Arrow-key cursor moves never write the URL. A cursor move that scrolls the camera to keep the cursor visible commits like any other settled camera.

### 3.4 Selection and the tree focus
- In the shell, the tree focus is the selection. Clicking a circle selects it (push) and flies to it. The spike's separate `focus` param is retired.
- A selected languoid that the Phase 1 tree does not draw (outside the 100 plus context): the tree flies to the nearest drawn ancestor and shows a note on the canvas: "{name} is not drawn in the tree yet. Showing {ancestor}." The Inspector shows the languoid itself.
- A country selection in the tree lens: the tree fits the root and highlights the languages CLDR records for that country (outline in `--tt-focus`). Nothing in the tree implies the language belongs to the country.

---

## 4. Inspector content

### 4.1 Anatomy (every entity)
1. Header: level chip (Language, Dialect, Family, Macrolanguage, Country or territory), family marker and two-letter label, the name in `font-display` `text-title`, the endonym in native script with `lang` and `dir` inside `<bdi>`, the romanization, the name in IPA when sourced. Buttons: Copy link, Close (desktop collapse; phone to peek).
2. Tabs (Radix Tabs, automatic activation). On desktop the tab list scrolls horizontally with visible overflow chevrons; on phones it scrolls with a fade edge.
3. Tab panel.
4. Go deeper: 3 to 6 cards at the end of every tab panel, not only Overview.

The Hook (SPEC section 5, item 1) appears at the top of Overview only for the gold-standard trio once content is approved. For other languages it is absent, not an empty state.

### 4.2 Language (and dialect)

#### At a glance (top of Overview)
Every value with a number or a claim carries a citation chip (4.6). Rows:

| Row | Content | Phase 1 source |
| --- | --- | --- |
| Own name | Endonym in native script, romanization | Wikidata or CLDR names, per row |
| Name in IPA | IPA string in `font-ipa` | Only when a sourced row exists; else "no data yet" |
| Family | Collapsed lineage, each item a link | Glottolog |
| Speakers | L1 range, Total range, with the mini glyph (section 5) | Wikidata P1098 |
| Spoken in | Up to 5 territories: name, share, official status; "and {n} more" links to Where | CLDR 49 (no year) |
| Scripts | Script names | Open: no Phase 1 source is planned (see open questions) |
| Status | Glottolog's endangerment value, verbatim | Glottolog |
| Codes | ISO 639-3, Glottocode, Wikidata QID; each links out to its registry | Glottolog, Wikidata |

For a languoid inside a macrolanguage: a slot under At a glance titled "Why linguists disagree", with the Lumper/Splitter control (section 6).

#### Tabs

| Tab | Phase 1 content | Empty state (title, then one line that teaches) |
| --- | --- | --- |
| Overview | Hook (trio only), At a glance, macrolanguage slot, Go deeper | Never empty |
| Speakers | Section 5 in full: L1, L2, Total, Kind not stated, deprecated figures folded | "No speaker figure yet." / "We show only estimates with a source. Wikidata has none for this language." |
| Where | Territory table (territory, share, official status, source), the Glottolog point with its note, "Show on map" button | "No territory data yet." / "CLDR lists no countries for this language. The map shows its Glottolog location." plus the "Show on map" button |
| Writing | Scripts in use, with source | "No script data yet." / "We have no sourced script list for this language. Scripts get their own pages in a later update." |
| Sounds | Greeting and numbers 1 to 10 where a cleared recording exists. Each row: text in native script, romanization, translation, Audio button, Recording badge, variety, license, source | "No recording yet." / "We play only real recordings with a clear license. None is cleared for this language yet." |
| Words | ASJP 40-item list: concept, form, transcription labeled "ASJPcode", source and doculect per row | "No word list yet." / "Word lists come from ASJP, which has no list for this language." |
| Family | Lineage (links), sister languages (in-scope first), dialects (Glottolog children), "Open in tree" button | Dialects part only: "Glottolog lists no dialects for this language." |
| Sources | Every source used on the page: attribution, version, license with link, retrieval date, locators used | Never empty (Glottolog is always present) |

**(P)** Words: ASJP forms are written in ASJPcode, not IPA. The column header says "ASJPcode" and links to an explanation. The UI never converts ASJPcode to IPA and never labels it IPA.

Sounds: speech never autoplays (SPEC 7). Every Audio button sits beside its badge (D-003). No synthetic audio in Phase 1.

### 4.3 Family

At a glance:
- Name (Glottolog), level, parent path.
- Languages: Glottolog's count of languages, and of dialects.
- Macroareas.
- In this atlas: "{n} of its languages have profiles." with links.
- Speakers: **(P)** no total. The row reads "We do not add up speaker figures across languages. Each language shows its own sources." Summing figures from different sources and years would create a number no source states (D-005).

Tabs:

| Tab | Content | Empty state |
| --- | --- | --- |
| Overview | At a glance, Go deeper | Never empty |
| Members | Children in Glottolog order, each with level and marker; scope languages flagged "Profile" | "Nothing deeper in this tree." / "Glottolog lists no members under this node." |
| Where | Member points on the map ("Show on map") and the macroareas | "No member has a location yet." / "Glottolog gives no coordinates for these languoids." |
| Sources | As for languages | Never empty |

### 4.4 Country or territory (if the route ships)
- Header: CLDR territory name in the interface language. Level chip "Country or territory". Never a flag.
- At a glance: number of languages CLDR records here, the borders note (D-019 rule 7), and the D-019 contested note when Natural Earth records a claim.
- Tabs:
  - Languages: table of languages, share of the population, official status, source (CLDR 49, "no year given"). Column header "Languages spoken here", never "Languages of {country}". Empty: "No language rows for this territory." / "CLDR records none. Language points on the map still show what is spoken here."
  - Sources.
- A selected neutral area (`?area=`): the Inspector reuses the spike's neutral panel ("Disputed or breakaway area"), with Go deeper cards to the languages whose Glottolog points fall inside it.

### 4.5 World view (no selection)
- Title: "Explore the world's languages".
- Body: "Click a circle to fly into a family. Search finds any language by name, code or script."
- A keyboard line: "Keyboard: Tab to the canvas, then use the arrow keys."
- Go deeper, kind "Start here": Persian, Turkish, English (pilot profiles), then the three largest top-level families by Glottolog language count.

### 4.6 Numbers: source and year on hover and tap
Component: Citation chip (DESIGN.md inventory).
- Visible always: the source short name and year beside the number, in `text-small text-ink-muted`, for example "Wikidata, 2019". CLDR rows say "CLDR 49, no year given".
- When a number aggregates several sources (a range): the chip says "{n} sources, {first year} to {last year}".
- Details popover (Radix Popover): source, year of the figure, kind (L1, L2, total, not stated), method, "Stated in" (the Wikidata reference: label and URL), locator, retrieved date, license, confidence chip, notes. For ranges: one row per source.
- Opens on click, tap, Enter or Space. On fine pointers it also opens on hover after 300 ms and stays open while the pointer is over the chip or the popover (WCAG 1.4.13: dismissable with Esc, hoverable, persistent).
- The chip is a button with a 44 px hit area (padding plus a transparent `::after`), even when its text is small.
- Canvas tooltips (hovering a bubble) show name, level and the same short source line. Tooltips are not interactive; full details live in the Inspector.

### 4.7 Loading, errors, not found
- Loading: the Inspector shows a skeleton in `--tt-surface` shapes (header bar, four glance rows, tab strip), `aria-busy="true"` on the panel, no shimmer under reduced motion. The header shows the name immediately when the click came from the canvas or search, since it is already known.
- Bundle failed: "Could not load the details." Button: "Try again". Below: Go deeper cards still render from tree data.
- Not found: "No language or family has the code {code}." Buttons: "Search the atlas", "Go to the world view".
- Canvas failed (no WebGL): "The {lens} could not start in this browser." Next step: "Use the list beside it, or switch to the {other lens}." The text list (9.5) and Inspector keep working.

### 4.8 Go deeper
Cards: one link each (the whole card), eyebrow with the kind (Related, Contrast, Surprise, Start here), entity name with marker, one-line reason. Minimum height 72 px. Stacked in the Inspector.

**(P)** Deterministic fallback so every view has at least three internal exits even without curation:

| Entity | Related | Contrast | Surprise |
| --- | --- | --- | --- |
| Language | Nearest scope language by tree distance; else the parent family | A scope language of another top-level family that shares a territory (largest CLDR share); else one from the same macroarea | Curated link (content/, written by content-writer); else the country of its largest share; else its top-level family |
| Family | Its parent, or a sibling family | Another top-level family in the same macroarea | Curated; else its scope member with the most dialects |
| Macrolanguage | Its largest member by Glottolog child count | Another macrolanguage in the set | Curated; else the lowest common ancestor family |
| Country | Language with the largest share | An official language from another family | Curated; else the family of the largest-share language |

Duplicates are removed. If fewer than three remain, add in order: top-level family, the world view, the same entity in the other lens. Reason lines come from templates (section 10).

---

## 5. Speakers display

### 5.1 Rules
- D-005: never averaged. A range is min to max of the figures of one kind; each source is listed with its year.
- Kinds are kept apart: L1, L2, Total, and **(P)** "Kind not stated" for Wikidata rows with kind unknown. A figure of unstated kind never enters the L1 or Total range.
- L1 is shown inside Total, visually (the glyph) and in text order (L1 first).
- Wikidata rank "deprecated": hidden from ranges, listed in a folded group "Deprecated in Wikidata ({n})". Rank "preferred": marked, no extra weight.
- A row without a Wikidata reference shows "No reference given in Wikidata" instead of "Stated in".
- `disagrees_gt_25pct`: a line under the range: "Figures differ by more than 25 percent."
- Formatting: compact long form in the interface locale (`Intl.NumberFormat(locale, { notation: "compact", compactDisplay: "long" })`), so Persian gets Persian digits. Exact values appear in the popover.
- If L1 exceeds Total because the figures come from different sources, show both as stated. The Speakers tab notes "These figures come from different sources and years." Never adjust a number.

### 5.2 Speakers tab layout
```text
First language (L1)        61 to 64 million        3 sources, 2011 to 2022  [i]
  64 million   2022   Wikidata, stated in {label}     Medium   [i]
  61 million   2011   Wikidata, stated in {label}     Medium   [i]
  ...
Second language (L2)       No figure yet
Total                      ...
Kind not stated            70 million              1 source, 2019  [i]
  70 million   2019   Wikidata, stated in asianstudies.unc.edu   Medium   [i]
Deprecated in Wikidata (2)  [show]
Sources disagree. We show each one and never average them.
```
Values in the sketch are placeholders, not data. A semantic `<table>` per kind with a `<caption>`. Optional in Phase 1: a strip chart (one dot per source on a value axis), `aria-hidden`, since the table carries the same facts.

### 5.3 The bubble (tree lens)
**(P)** Glyph anatomy, drawn by viz-engineer:

| Part | Encodes | Drawing |
| --- | --- | --- |
| Inner disc | L1 | Filled, family mark color. Radius from the L1 minimum. |
| Outer ring | Total | 1.5 px stroke, family mark color, at the Total minimum. |
| Range band | Disagreement | A translucent band from the minimum to the maximum of that kind. A single figure has no band. |
| Dashed ring | Kind not stated only | Dashed stroke at the minimum, band to the maximum. No disc. |
| No-data ring | No figure of any kind | Fixed radius (the smallest bubble size), dotted 1 px stroke in `--tt-line-strong`, family marker at its center. Never a guessed size. |

- Area grows with the figure (radius proportional to the square root), on one scale for the whole canvas. viz-engineer picks the constant and the layout.
- The legend shows every part and a reference circle for one million.
- Screen-reader text per bubble (describe.ts extension): "Turkish, language, Turkic. L1: {range}. Total: {range}." or "... No speaker figure yet."
- A lumped macrolanguage bubble uses only figures stated for the macrolanguage itself (section 6). It never sums its members.
- Map lens in Phase 1: points stay fixed-size markers. Speaker dots on the map are later (Phase 2).

---

## 6. Lumper/Splitter (Arabic, Chinese, Persian)

### 6.1 Model
- Default view is split: Glottolog's tree, where each member is its own language (D-002).
- Lumped: the member languages collapse into one labeled bubble, "{Name} (macrolanguage)", placed at their lowest common ancestor in the Glottolog tree. Its outline is dashed to mark it as a grouping, not a Glottolog node.
- Membership comes from a sourced table (data-curator; rights-auditor clears the source, for example the ISO 639-3 macrolanguage mappings or CLDR's macrolanguage aliases). linguist-reviewer checks it. Persian: Iranian Persian (`west2369`), Dari, Tajik, per the plan, pending the owner.
- The Wikidata figures and CLDR rows now attached to `fars1254` or left unmapped belong to the macrolanguage entity (data-curator).

### 6.2 Where the control lives
- In the Inspector of the macrolanguage and of each member, in the slot "Why linguists disagree" under At a glance. A two-option radio group: "Split (Glottolog)" and "Grouped (ISO 639-3)".
- In the tree, a lumped bubble carries a small "Grouped" tag; selecting it opens the macrolanguage Inspector with the control.
- Not in the top bar: it is a per-entity question, not a global mode.
- Keyboard: on a canvas cursor over a member or a lumped bubble, `L` toggles that macrolanguage (canvas focus only, 9.4).

### 6.3 What changes
- Tree: members morph into the grouped bubble (600 ms spring, DESIGN.md panel settings), or out of it. Reduced motion: crossfade 200 ms.
- Map: no new point is invented (Glottolog has no coordinate for a macrolanguage). Grouped: member points share a dashed hull and one label. CLDR shares for the macrolanguage code fill countries when the macrolanguage is selected.
- Breadcrumbs: the macrolanguage crumb appears between the lowest common ancestor and the member.
- Search: the macrolanguage always appears as its own result, whatever the state.
- Selecting a member while it is grouped: the tree flies to the grouped bubble and the Inspector shows the member with the note "Shown inside {macro} (grouped). Split it to see this language on its own." and a "Split {macro}" button.
- Live region: "{macro} shown as one macrolanguage." or "{macro} split into {n} languages."

### 6.4 Explanation slot
- Heading "Why linguists disagree". Body text by content-writer, reviewed by linguist-reviewer, attributed positions only (CONTENT_STYLE "Sensitive topics"), with citations.
- Empty: "Explanation not written yet." / "Until it is, see the sources for each member language." with links to the members.

---

## 7. Search

### 7.1 Index
Built by the pipeline (plan step 2). **(P)** Two tiers:

| Tier | Contents | Loaded |
| --- | --- | --- |
| 1 | The 100 scope languages, their ancestor families, the 3 macrolanguages, countries | On idle after first paint, and on palette open |
| 2 | Every other Glottolog languoid (about 27,000) | When the palette opens, or when tier 1 has no hit |

Fields per document: English display name, Glottolog name, endonyms (native script) and their romanizations, alternate names, Persian and Turkish names (CLDR and Wikidata), ISO 639-3, Glottocode, Wikidata QID, aliases with an `alias: true` flag ("Farsi" for Persian, D-004), level, family id, in-scope flag, drawn-in-tree flag.

Matching: diacritic- and case-insensitive (the spike's `normalize`), prefix and fuzzy (edit distance 1 from 5 characters). Codes match exactly. Minimum query: 2 characters, or 1 for non-Latin scripts. Ranking: exact name, exact code, prefix, alias, fuzzy; then in-scope before out-of-scope; languages before dialects.

The MiniSearch library and both index files load outside the app-shell bundle.

### 7.2 Result layout
Groups in order: Languages, Macrolanguages, Families, Countries, Dialects. Up to 8 per group, then "Show all {n}".

Each row (44 px minimum, 56 px with two lines):
```text
[marker]  Turkish   Türkçe                              Language
          Turkic / Oghuz            ISO 639-3: tur
```
- Line 1: display name with the matched part in bold, endonym in its script (`lang`, `dir`, `<bdi>`), level on the inline-end.
- Line 2: short family path (top family and parent), and the reason for the match when it was not the display name: "Alias: {alias}", "ISO 639-3: {code}", "Glottocode: {code}", "Also called {name}".
- Out-of-tree languoids add "Not drawn in the tree yet".

### 7.3 Keyboard model
ARIA combobox inside a modal dialog (Radix Dialog), `aria-activedescendant` on the input.
- Ctrl+K or Cmd+K: open (and select the input text if already open).
- Typing: results update after 80 ms.
- Down and Up: move the active row, wrapping. Page Down and Page Up: 5 rows. Home and End stay in the input.
- Enter: open the active row. Alt+Enter: open it in the other lens.
- Esc: clears the query; a second Esc closes. Closing returns focus to the element that opened the palette.
- Tab: moves to "Show all" buttons and stays inside the dialog.
- A polite live region inside the dialog announces "{n} results" 500 ms after typing stops.

### 7.4 What a result does
1. Close the palette.
2. Push the entity route, keeping `lens`, `lump` and `lang`, with no camera params.
3. Fly the active lens to the selection.
4. Open the Inspector at Overview (sheet at half on phones).
5. Move focus to the Inspector heading (`tabIndex=-1`), and announce "Selected {name}, {level}."

Reach: any languoid in at most three interactions (open, type, Enter). SPEC section 8.

---

## 8. Layouts and motion

Dimensions: top bar 56 px, breadcrumb row 44 px, time strip 56 px desktop and 44 px phone, Inspector `clamp(360px, 30vw, 440px)` (432 px at 1440). Placeholders like `<fa: Search>` stand for Persian strings awaiting translation; the spec does not invent them.

### 8.1 Desktop, 1440 x 900, English
```text
+----------------------------------------------------------------------------------------------------------+
| (o) Tree of Tongues     [ Search languages, families, countries   Ctrl K ]    [Tree|Map]     [Settings v] |  56
+-----------------------------------------------------------------------+----------------------------------+
| World > Indo-European > [...] > Farsic > Persian (grouped) > Iranian Persian |  INSPECTOR  432             |  44
+-----------------------------------------------------------------------+  [IE] Language    [Copy link][>]|
|                                                   [Inside Farsic (6) v]|  Iranian Persian (display font) |
|                                                                       |  <bdi fa>name</bdi>  romanized  |
|                                                                       |  ------------------------------ |
|                    CANVAS (Tree or Map)                               |  Overview|Speakers|Where|Wri.. >|
|                    1008 x 744                                          |  ------------------------------ |
|                                                                       |  AT A GLANCE                     |
|                                                                       |  Own name    ...    [Wikidata]   |
|                                                                       |  Family      IE > ... > Farsic   |
|                                                                       |  Speakers    L1 ... [3 sources]  |
|                                                                       |  Spoken in   ...    [CLDR 49]    |
|                                                                       |  Status, Codes                   |
|  [Legend ^]                                          [+] [-] [Home]   |  WHY LINGUISTS DISAGREE          |
+-----------------------------------------------------------------------+  (o) Split  ( ) Grouped          |
|  Year  Today  [------------------------------------------------o]     |  GO DEEPER                       |
|  Time travel comes in a later update. Everything shows today's data.  |  [Related]  Dari                 |
+-----------------------------------------------------------------------+  [Contrast] ...                  |
|  Borders are approximate ... (map lens)            Sources and credits|  [Surprise] ...                  |
+-----------------------------------------------------------------------+----------------------------------+
```
- The Inspector scrolls on its own; the header and tab list stick.
- Canvas overlays sit 16 px from the canvas edges, inside the canvas column, never under the Inspector.
- "Inside {name}" (tree) or "In view" (map) is the text list (9.5), a disclosure at the inline-end top of the canvas.

### 8.2 Desktop, 1440 x 900, Persian (RTL)
```text
+----------------------------------------------------------------------------------------------------------+
| [<fa: Settings> v]     [<fa: Tree>|<fa: Map>]    [ Ctrl K   <fa: Search ...> ]        <fa: Tree of Tongues> (o) |
+----------------------------------+-----------------------------------------------------------------------+
|           INSPECTOR  432          | <fa: Iranian Persian> < ... < [...] < <fa: Indo-European> < <fa: World>  |
| [<][<fa: Copy>] <fa: Language> [IE]+-----------------------------------------------------------------------+
|   <fa: Iranian Persian>           |[<fa: Inside> v]                                                        |
|   ...                             |                                                                       |
|  < ..|<fa: Where>|<fa: Speakers>|<fa: Overview> |              CANVAS (not mirrored)                    |
|   <fa: At a glance>               |                                                                       |
|   ...                             |                                                                       |
|   <fa: Go deeper>                 |   [Home] [-] [+]                                         [Legend ^]   |
|                                   +-----------------------------------------------------------------------+
|                                   |     [o------------------------------------------------]  <fa: Today>  <fa: Year> |
|                                   |     <fa: Time travel comes in a later update ...>                      |
+----------------------------------+-----------------------------------------------------------------------+
```
- The shell mirrors: Inspector at inline-end (left), crumbs and tabs run right to left, chevrons flip, the slider's present end is on the left.
- The canvas content does not mirror: the map keeps geography, the tree keeps its layout.
- English proper names inside Persian text keep `dir="ltr"` with `<bdi>`.
- Persian UI text uses Noto Naskh Arabic; script-typographer sets line height (at least 1.7 for body) and checks the tab strip at that height.

### 8.3 Phone, 390 x 844, English
Peek (selection exists):
```text
+--------------------------------------+
| (o)  [ Search      ]  [Tree|Map] [=] |  56   (o) = home, [=] = settings
+--------------------------------------+
| [...]  Farsic  >  Iranian Persian    |  44
+--------------------------------------+
|                                      |
|            CANVAS                    |
|            390 x 588                 |
|                    [Inside (6) v]    |
|  [Legend]              [+][-][Home]  |
+--------------------------------------+
| Year: Today. Time travel comes later.|  44
+--------------------------------------+
|              ====                    |  handle (44 px button)
| [IE] Iranian Persian    <bdi fa>     |
| L1 ... (3 sources)          [>]      |  112 peek
+--------------------------------------+
```
Half (50 dvh) and full (100 dvh minus 56):
```text
+--------------------------------------+      +--------------------------------------+
| top bar                              |      | top bar                              |
| crumbs                               |      +--------------------------------------+
| CANVAS (upper half, still live)      |      |              ====                    |
+--------------------------------------+      | [IE] Language        [Copy] [v]      |
|              ====                    |      | Iranian Persian                      |
| [IE] Language        [Copy] [v]      |      | Overview|Speakers|Where|...  >       |
| Iranian Persian                      |      | AT A GLANCE ...                      |
| Overview|Speakers|Where|...  >       |      | ...                                  |
| AT A GLANCE (scrolls)                |      | GO DEEPER ...                        |
+--------------------------------------+      +--------------------------------------+
```
- On phones the time strip shows one line: "Year: Today. Time travel comes later." Its full sentence is the strip's accessible description.
- The time strip sits above the peek and is covered at half and full.
- Bottom padding includes `env(safe-area-inset-bottom)`.
- No selection: the peek shows "Explore the world's languages" and "Tap a circle, or search."
- The Search button shows the word "Search" with an icon; the shortcut hint is hidden on touch devices.

### 8.4 Bottom sheet behavior
- Stops: peek 112 px, half 50 dvh, full (viewport minus the top bar).
- The handle is a real button: tap or Enter cycles peek, half, full, half. Up and Down arrow keys on the handle move one stop. Drag follows the finger; release snaps to the nearest stop by position and velocity.
- At full, the canvas and time strip are `inert`, and Esc returns to half. The sheet is never a modal trap at peek or half.
- A new selection opens the sheet at half if it was at peek because of a search or a Go deeper card; a canvas tap keeps the current stop (so exploring the tree is not interrupted).

### 8.5 Phone, 390 x 844, Persian (RTL)
Same structure as 8.3, mirrored: home at inline-start (right), settings at inline-end (left), crumbs right to left, slider present end on the left. The sheet handle stays centered. Canvas not mirrored.

### 8.6 Motion

| Event | Normal | Reduced motion |
| --- | --- | --- |
| Select in tree (descend or ascend) | Camera flight, `flightDuration(levels crossed)` 600 to 1200 ms, `ease-flight`. Siblings dim to 40 percent over 280 ms. Children bloom with the spring (220, 26, 1), 24 ms stagger, capped at 12. | Camera jumps behind a 200 ms crossfade. No bloom. Dimming is instant. |
| Select on map | `easeTo` or `fitBounds` with `flightDuration(2)` | Jump behind a 200 ms crossfade |
| Interrupted flight | Starts from the current camera, never the old target | Same |
| Back or forward | Flight to the restored camera | Crossfade |
| Lens switch | 280 ms crossfade between canvases; the incoming camera is already at the selection | 200 ms crossfade |
| Lump or split | 600 ms morph with the panel spring (120, 20) | 200 ms crossfade |
| Inspector open (desktop) | 280 ms, `ease-enter`, 16 px from inline-end plus opacity | Opacity only, 200 ms |
| Inspector content change | Body crossfades 200 ms; header text swaps at the midpoint | Same (opacity only) |
| Tab change | 200 ms fade of the panel | Instant |
| Sheet stop change | Panel spring (120, 20); drag follows the finger | Jump, 200 ms opacity on the content |
| Palette open and close | 200 ms opacity and scale 0.98 to 1, `ease-enter`; close `ease-exit` | Opacity only |
| Popover | 200 ms fade | Instant |
| Skeleton | Static shapes. No shimmer at all in Phase 1 | Same |

Nothing loops. Use `motionFor(kind, reduced)` and `usePrefersReducedMotion()` everywhere (DESIGN.md); the Motion setting (1.8) feeds the same switch through `data-motion`.

---

## 9. Accessibility

### 9.1 Landmarks
- `header` (banner): wordmark, search button, lens switcher, settings.
- `nav aria-label="Path"`: breadcrumbs.
- `main`: lens region (`section aria-label="{lens name}"`), canvas overlays, time strip, footer strip.
- `aside aria-labelledby={inspector heading id}`: the Inspector. **(P)** The Inspector heading (the entity name) is the h1 on entity routes and "Explore the world's languages" is the h1 on `/`, so each page has one h1 that names it.
- Dialogs (palette, keyboard help) are modal with `aria-labelledby`.

### 9.2 Skip links
First focusable elements, visible on focus: "Skip to details" (Inspector heading), "Skip to the canvas".

### 9.3 Focus order (LTR and RTL alike, DOM order)
1. Skip links. 2. Wordmark. 3. Search button. 4. Lens switcher (one tab stop). 5. Settings. 6. Breadcrumbs. 7. Canvas (one tab stop). 8. Canvas overlays: text list disclosure, legend, zoom in, zoom out, show everything. 9. Time strip (not focusable in Phase 1; read in browse mode). 10. Inspector: collapse, copy link, heading target, tab list (one stop), tab panel content, Go deeper cards. 11. Footer strip links.

Focus rules:
- After a selection from search or a Go deeper card: focus moves to the Inspector heading.
- After a selection from the canvas (click or Enter): focus stays on the canvas, so arrow-key exploration continues.
- After a crumb: focus stays on the breadcrumb list (the new current crumb).
- Closing any overlay returns focus to its opener.
- Focus ring: DESIGN.md (3 px `--tt-focus`, 2 px offset; canvases use the inset ring from the Phase 0 fix).

### 9.4 Keyboard map

| Where | Key | Action |
| --- | --- | --- |
| Anywhere | Ctrl+K, Cmd+K | Open search |
| Anywhere | Esc | Close the topmost layer: popover, then dialog, then sheet full to half. Only when no layer is open does Esc reach the canvas (go to parent). |
| Canvas, tree | Arrow keys | First press shows the cursor; then move among the children of the selection (spike behavior) |
| Canvas, tree | Enter | Select the cursor item and fly in (push) |
| Canvas, tree | Esc, Backspace | Select the parent and fly out (push) |
| Canvas, tree | Home | World view |
| Canvas, tree | +, = and -, _ | Zoom in and out around the center |
| Canvas, tree | L | Lump or split the macrolanguage under the cursor or selection |
| Canvas, map | Arrow keys | Pan (MapLibre) |
| Canvas, map | +, - | Zoom (MapLibre) |
| Canvas, both | 1, 2 | Tree lens, Map lens |
| Canvas, both | I | Move focus to the Inspector heading |
| Canvas, both | ? | Open keyboard help |
| Lens switcher | Arrow keys | Move and select (mirrored in RTL) |
| Inspector tabs | Left, Right (mirrored in RTL), Home, End | Move and activate tabs |
| Sheet handle | Enter, Space; Up, Down | Cycle stops; one stop up or down |
| Palette | Section 7.3 | |
| Citation chip | Enter, Space; Esc | Open; close |

**(P)** Single-character shortcuts (1, 2, I, L, ?) work only while the canvas has focus (WCAG 2.2 SC 2.1.4, "active only on focus"). No global single-key shortcuts.

### 9.5 Screen-reader text for canvases
- Tree canvas: `role="application"`, label "Language family tree. Circles inside circles.", described by the visible help line. Every selection, cursor move and zoom-out is announced (spike behavior, extended with speakers from 5.3).
- Map canvas: label from the spike (`S.mapLabel`).
- Text alternative for both: the "Inside {name}" list (tree) and the "In view ({n})" list (map, the languages whose points are in the viewport, capped at 40, largest share first, then by name). Each item is a button that selects.
- The legend is real HTML text: family name, two-letter label, marker, pattern; the bubble key in words.
- Canvas tooltips are duplicated in the Inspector; they are `aria-hidden`.

### 9.6 Live regions
- One shell-level polite region (`role="status"`), fed by `announce()`. It carries: selections ("Selected Turkish, language, Turkic."), lens changes ("Map view."), lump and split, "Link copied.", restored history entries, the tree announcements.
- The palette has its own polite region for result counts.
- Errors render in place with `role="alert"`.
- The Inspector body gets `aria-busy` while loading; no announcement for skeletons.

### 9.7 Other checks
- Contrast: tokens only (DESIGN.md tables). The range band and no-data ring are marks (3:1 against canvas).
- Targets: 44 px for every control, including crumbs, chips, tabs, the sheet handle and zoom buttons.
- Zoom and reflow: the shell works at 200 percent text and at 320 px width (WCAG 1.4.10); below 360 px the lens switcher becomes icon-only with labels kept as accessible names.
- `prefers-reduced-motion` and the Motion setting both apply (8.6).
- Every multilingual string carries `lang` and `dir`.

---

## 10. Microcopy

All strings below are new UI copy in English. Persian (fa) and Turkish (tr): **to be translated, owner review** for every row. They go into `src/i18n/en.json` under the keys shown; `fa.json` and `tr.json` keep English fallbacks marked "awaiting owner review" until Siavash approves. ICU syntax for plurals.

### Shell, navigation, settings
| Key | English |
| --- | --- |
| shell.skipToDetails | Skip to details |
| shell.skipToCanvas | Skip to the canvas |
| shell.home | Tree of Tongues, home |
| search.button | Search |
| search.buttonLong | Search languages, families, countries |
| search.shortcut | Ctrl K |
| search.shortcutMac | ⌘ K |
| lens.label | View |
| lens.tree | Tree |
| lens.map | Map |
| lens.announceTree | Tree view. |
| lens.announceMap | Map view. |
| crumbs.label | Path |
| crumbs.world | World |
| crumbs.more | Show the full path |
| crumbs.grouped | {name} (grouped) |
| time.label | Year |
| time.today | Today |
| time.later | Time travel comes in a later update. Everything shows today's data. |
| time.laterShort | Year: Today. Time travel comes later. |
| settings.button | Settings |
| settings.theme | Theme |
| settings.language | Interface language |
| settings.motion | Motion |
| settings.motionSystem | Follow system |
| settings.motionReduced | Reduced |
| settings.shortcuts | Keyboard shortcuts |
| help.title | Keyboard shortcuts |
| help.canvasOnly | Single keys work while the canvas has focus. |
| footer.credits | Sources and credits |
| footer.classification | Classification: Glottolog 5.3 |

### Search
| Key | English |
| --- | --- |
| search.dialog | Search the atlas |
| search.placeholder | Language, family, country or code |
| search.help | Type a name in any script, an ISO 639-3 code or a Glottocode. |
| search.minChars | Type at least two letters. |
| search.loading | Loading the search index |
| search.loadingAll | Searching every Glottolog languoid |
| search.none | No match for "{query}". |
| search.noneNext | Try another spelling, the name in its own script, or an ISO 639-3 code. |
| search.count | {count, plural, one {# result} other {# results}} |
| search.groupLanguages | Languages |
| search.groupMacro | Macrolanguages |
| search.groupFamilies | Families |
| search.groupCountries | Countries and territories |
| search.groupDialects | Dialects |
| search.showAll | Show all {count} |
| search.matchAlias | Alias: {alias} |
| search.matchIso | ISO 639-3: {code} |
| search.matchGlottocode | Glottocode: {code} |
| search.matchName | Also called {name} |
| search.notInTree | Not drawn in the tree yet |
| search.keys | Up and Down to move. Enter to open. Esc to close. |
| search.error | Search could not load. |
| search.retry | Try again |

### Inspector frame
| Key | English |
| --- | --- |
| inspector.label | Details |
| inspector.collapse | Hide details |
| inspector.expand | Show details |
| inspector.copyLink | Copy link |
| inspector.copied | Link copied. |
| inspector.loading | Loading details |
| sheet.handle | Resize the details panel |
| sheet.peek | Details, small |
| sheet.half | Details, half screen |
| sheet.full | Details, full screen |
| level.language | Language |
| level.dialect | Dialect |
| level.family | Family |
| level.macrolanguage | Macrolanguage |
| level.country | Country or territory |
| tab.overview | Overview |
| tab.speakers | Speakers |
| tab.where | Where |
| tab.writing | Writing |
| tab.sounds | Sounds |
| tab.words | Words |
| tab.family | Family |
| tab.sources | Sources |
| tab.members | Members |
| tab.languages | Languages |
| welcome.title | Explore the world's languages |
| welcome.body | Click a circle to fly into a family. Search finds any language by name, code or script. |
| welcome.bodyTouch | Tap a circle, or search. |
| welcome.keyboard | Keyboard: Tab to the canvas, then use the arrow keys. |

### At a glance and citations
| Key | English |
| --- | --- |
| glance.title | At a glance |
| glance.ownName | Own name |
| glance.ipa | Name in IPA |
| glance.family | Family |
| glance.speakers | Speakers |
| glance.spokenIn | Spoken in |
| glance.more | and {count} more |
| glance.scripts | Scripts |
| glance.status | Status |
| glance.codes | Codes |
| glance.noData | No data yet |
| glance.languagesCount | {count, plural, one {# language} other {# languages}} |
| glance.dialectsCount | {count, plural, one {# dialect} other {# dialects}} |
| glance.inAtlas | {count, plural, one {# of its languages has a profile.} other {# of its languages have profiles.}} |
| glance.macroareas | Macroareas |
| cite.sourcesCount | {count, plural, one {# source} other {# sources}} |
| cite.years | {from} to {to} |
| cite.noYear | no year given |
| cite.source | Source |
| cite.year | Year |
| cite.kind | Kind |
| cite.method | Method |
| cite.statedIn | Stated in |
| cite.noReference | No reference given in Wikidata |
| cite.locator | Locator |
| cite.retrieved | Retrieved |
| cite.license | License |
| cite.confidence | Confidence |
| cite.notes | Notes |
| cite.open | Open the source |
| cite.close | Close |

### Speakers
| Key | English |
| --- | --- |
| speakers.l1 | First language (L1) |
| speakers.l2 | Second language (L2) |
| speakers.total | Total |
| speakers.unstated | Kind not stated |
| speakers.range | {low} to {high} |
| speakers.deprecated | Deprecated in Wikidata ({count}) |
| speakers.preferred | Preferred in Wikidata |
| speakers.neverAveraged | Sources disagree. We show each one and never average them. |
| speakers.differ | Figures differ by more than 25 percent. |
| speakers.mixed | These figures come from different sources and years. |
| speakers.familyNote | We do not add up speaker figures across languages. Each language shows its own sources. |
| speakers.macroNote | These figures are stated for {name} as a whole. We never add up its member languages. |
| speakers.srBubble | L1: {l1}. Total: {total}. |
| speakers.srNone | No speaker figure yet. |
| legend.title | Legend |
| legend.families | Families |
| legend.l1 | Inner disc: first-language speakers (L1) |
| legend.total | Ring: total speakers |
| legend.band | Band: sources disagree, from lowest to highest |
| legend.unstated | Dashed ring: kind of figure not stated |
| legend.none | Dotted ring: no figure yet. Size means nothing. |
| legend.area | Circle area grows with speakers. |
| legend.million | One million |

### Empty states
| Key | English |
| --- | --- |
| empty.speakers | No speaker figure yet. |
| empty.speakersWhy | We show only estimates with a source. Wikidata has none for this language. |
| empty.where | No territory data yet. |
| empty.whereWhy | CLDR lists no countries for this language. The map shows its Glottolog location. |
| empty.writing | No script data yet. |
| empty.writingWhy | We have no sourced script list for this language. Scripts get their own pages in a later update. |
| empty.sounds | No recording yet. |
| empty.soundsWhy | We play only real recordings with a clear license. None is cleared for this language yet. |
| empty.words | No word list yet. |
| empty.wordsWhy | Word lists come from ASJP, which has no list for this language. |
| empty.dialects | Glottolog lists no dialects for this language. |
| empty.members | Nothing deeper in this tree. |
| empty.membersWhy | Glottolog lists no members under this node. |
| empty.familyWhere | No member has a location yet. |
| empty.familyWhereWhy | Glottolog gives no coordinates for these languoids. |
| empty.country | No language rows for this territory. |
| empty.countryWhy | CLDR records none. Language points on the map still show what is spoken here. |
| empty.explanation | Explanation not written yet. |
| empty.explanationWhy | Until it is, see the sources for each member language. |
| where.showOnMap | Show on map |
| where.spokenHere | Languages spoken here |
| family.openInTree | Open in tree |
| family.sisters | Sister languages |
| words.asjp | ASJPcode |
| words.asjpWhat | What is ASJPcode? |
| profile.badge | Profile |

### Errors and loading
| Key | English |
| --- | --- |
| error.bundle | Could not load the details. |
| error.retry | Try again |
| error.notFound | No language or family has the code {code}. |
| error.search | Search the atlas |
| error.world | Go to the world view |
| error.canvas | The {lens} could not start in this browser. |
| error.canvasNext | Use the list beside it, or switch to the {other}. |
| loading.tree | Loading the tree |
| loading.map | Loading the map |
| tree.notDrawn | {name} is not drawn in the tree yet. Showing {ancestor}. |
| tree.label | Language family tree. Circles inside circles. |
| map.inView | In view ({count}) |
| zoom.in | Zoom in |
| zoom.out | Zoom out |
| zoom.all | Show everything |

### Go deeper
| Key | English |
| --- | --- |
| deeper.title | Go deeper |
| deeper.related | Related |
| deeper.contrast | Contrast |
| deeper.surprise | Surprise |
| deeper.start | Start here |
| deeper.sameBranch | Same branch: {group} |
| deeper.parent | The family it belongs to |
| deeper.sharesPlace | Also spoken in {place}, from another family |
| deeper.sameArea | Another family in {macroarea} |
| deeper.largestShare | Where it has its largest share |
| deeper.member | A member of this family |
| deeper.otherMacro | Another case of lumping and splitting |
| deeper.pilot | A full profile with sources |
| deeper.bigFamily | {count, plural, other {# languages in Glottolog}} |
| deeper.otherLens | See it on the {lens} |

### Lumper/Splitter
| Key | English |
| --- | --- |
| macro.heading | Why linguists disagree |
| macro.control | How to show {name} |
| macro.split | Split (Glottolog) |
| macro.grouped | Grouped (ISO 639-3) |
| macro.tag | Grouped |
| macro.name | {name} (macrolanguage) |
| macro.memberNote | Shown inside {macro} (grouped). Split it to see this language on its own. |
| macro.splitButton | Split {macro} |
| macro.announceGrouped | {macro} shown as one macrolanguage. |
| macro.announceSplit | {macro} split into {count} languages. |

Names (Persian, "Iranian Persian" and others) are data, not microcopy. They come from the bundles and D-004.

---

## 11. Acceptance criteria

Each item names how it is checked: unit (Vitest), e2e (Playwright), a11y (axe plus Playwright), visual (screenshots reviewed), perf (Lighthouse or bench).

### URL and history
1. unit: `toShellHref(parseShellUrl(url))` returns the canonical form for every example in 2.2 and for 200 generated states; defaults are omitted; params come out in the 2.2 order.
2. unit: invalid values (`lens=time`, `tz=abc`, `map=99/200/0`, `lump=xyz`, `year=0`) are dropped; e2e: the address bar shows the canonical URL after load (replace, no extra history entry).
3. e2e: select Turkish, then its family, then switch to Map, then press Back three times: the view returns to the family in Tree, then Turkish, then the world, each with its earlier camera.
4. e2e: pan the tree, wait 500 ms: `tz` or `tc` appears; history length is unchanged. Pan continuously for 3 s: at most 4 URL writes.
5. e2e: open a URL with `lens`, `tab`, `lump`, `tz`, `tc`, `map` and `lang=fa` in a fresh context: selection, lens, tab, grouping, camera (within 2 px of the original framing at the same viewport) and the Persian interface are restored.
6. e2e: switch to Persian, select another language, press Back: the interface stays Persian and the URL carries `lang=fa`.
7. e2e: `/language/indo1319` ends at `/family/indo1319`; `/language/zzzz9999` shows the not-found state with both next-step buttons.
8. build: every prerendered path in 2.7 exists as HTML containing the h1, the At a glance block with citation text, and at least three `<a href>` Go deeper links, with JavaScript disabled.

### Shell and Inspector
9. e2e at 1440 x 900: the Inspector is at the right in English and at the left in Persian; the canvas content is not mirrored.
10. e2e at 390 x 844: the sheet opens at peek on a shared link, cycles peek, half, full with the handle by tap and by keyboard; at full the canvas is inert and Esc returns to half.
11. e2e: on every route and lens, the Inspector shows at least three Go deeper cards with distinct internal targets (also with curated links removed).
12. e2e: for a scope language with no speaker data, no territory data, no recording and no word list, each tab shows its empty-state title and line from section 10, and no tab is blank.
13. e2e: with `/data/bundles/{code}.json` blocked, the Inspector shows "Could not load the details." and "Try again" works after unblocking.
14. e2e: with WebGL disabled, the lens shows the canvas error and the text list and Inspector still select languages.
15. unit: the time strip renders the label, "Today" and the message; it contains no focusable element; `?year=1500` is stripped.

### Provenance and speakers
16. e2e: every number in At a glance and the Speakers tab has a visible source and year (or "no year given") and opens a popover with source, locator, retrieved date, license and confidence by click, by tap (touch emulation) and by Enter.
17. unit: given fixture figures (two L1, one Total, one unstated, one deprecated), the L1 range is min to max of the two L1 figures, the unstated figure is not in any range, the deprecated one is folded, and no rendered value equals the mean.
18. unit: a family Inspector renders no speaker total; a lumped macrolanguage uses only its own figures (fixture with members' figures summing to a different value).
19. unit: bubble glyph spec: no figure gives the fixed no-data radius; unstated-only gives the dashed style; a range gives a band; describe text matches section 10.

### Lumper/Splitter
20. e2e: on Persian, choose Grouped: the URL gains `lump=fas` (push), the tree shows one grouped bubble with the "Grouped" tag, the crumb appears, the live region announces it; Back restores the split view.
21. e2e: with `lump=fas`, searching a member selects it and shows the member note with "Split Persian".

### Search
22. e2e: Ctrl+K opens the palette from the canvas, from the Inspector and from a text field; the visible Search button opens it too.
23. e2e: "Farsi" returns Persian with "Alias: Farsi"; "tur" returns Turkish by ISO code; "west2369" returns its languoid; "فارسی" and "Türkçe" return their languages; "turkce" finds Türkçe.
24. e2e: for a random sample of 20 out-of-scope languoids, open, type the Glottocode, press Enter: the Inspector shows it within three interactions, and the tree shows the "not drawn" note.
25. e2e: keyboard-only: Down, Up, Page Down, Enter, Esc (clear), Esc (close) behave as 7.3; focus returns to the opener; result counts are announced.
26. perf: the app-shell initial JavaScript stays at or under 250 KB gzip with the shell in place; MiniSearch, the indexes, PixiJS, MapLibre and deck.gl are not in it.

### Accessibility and motion
27. a11y: axe reports no violations on `/`, a language, a family, a macrolanguage and a country route, in English and Persian, at both sizes, with the palette open and the sheet at each stop.
28. e2e: Tab order matches 9.3 at 1440 and 390; both skip links move focus to their targets.
29. e2e: the tree keyboard path from the spike works in the shell (arrows, Enter, Esc, Backspace, Home, +, -); 1, 2, I, L and ? work only when the canvas has focus and do nothing while typing in any field.
30. e2e: every interactive element in the shell measures at least 44 x 44 px (bounding box, including citation chips via their hit area) at both sizes.
31. e2e with `prefers-reduced-motion: reduce`, and again with the Motion setting on Reduced: selection, back, lens switch and lump produce no camera animation longer than 200 ms (sampled camera state) and no transform animations on panels.
32. visual: screenshots of 8.1, 8.2, 8.3 and 8.5 in Night and Parchment, reviewed against the wireframes; no console errors; no third-party requests.
33. content: `pnpm lint:content` passes; no em dash in `en.json`; the English UI never shows "Farsi" except as a search alias label.

---

## Later, kept out of Phase 1 on purpose
- Time lens, real time slider, `year` param (Phase 2).
- Classification lens control and `class=traditional`.
- Size metric and Color by controls; global mute; UI sounds (Phase 2).
- Speaker dots and speaker bubbles on the map (Phase 2).
- Prerendered Persian and Turkish page trees.
- Word, sound, script, event and trail routes (Phases 2 to 4).
- "Report a problem" link per fact.
