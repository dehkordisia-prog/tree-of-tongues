import { beforeEach, describe, expect, it } from "vitest";

import { CAMERA_DEBOUNCE_MS, createShellStore, type HistoryWriter } from "./shell";
import { parseShellUrl } from "./url";

// A fake clock and router: navigate() records push or replace and feeds the URL back into the
// store the way <UrlSync> does; camera writes land in `replaced`.
function setup(initial = "/") {
  const store = createShellStore();
  const log: { href: string; replace: boolean }[] = [];
  const replaced: string[] = [];
  let now = 0;
  let timers: { at: number; fn: () => void; id: number }[] = [];
  let nextId = 1;
  const history: HistoryWriter = {
    replaceUrl: (h) => replaced.push(h),
    now: () => now,
    setTimer: (fn, ms) => {
      const id = nextId++;
      timers.push({ at: now + ms, fn, id });
      return id;
    },
    clearTimer: (id) => {
      timers = timers.filter((t) => t.id !== id);
    },
  };
  const hydrate = (href: string, cause: "load" | "push" | "replace" | "pop") => {
    const u = new URL(href, "https://x.test");
    store.getState().hydrateFromUrl(parseShellUrl(u.pathname, u.search).state, cause);
  };
  store.getState().bind((href, { replace }) => {
    log.push({ href, replace });
    hydrate(href, replace ? "replace" : "push");
  }, history);
  hydrate(initial, "load");
  const advance = (ms: number) => {
    const end = now + ms;
    for (;;) {
      const due = timers.filter((t) => t.at <= end).sort((a, b) => a.at - b.at)[0];
      if (!due) break;
      now = due.at;
      timers = timers.filter((t) => t !== due);
      due.fn();
    }
    now = end;
  };
  return { store, log, replaced, advance, s: () => store.getState() };
}

describe("history rules (spec 2.4)", () => {
  let t: ReturnType<typeof setup>;
  beforeEach(() => {
    t = setup("/");
  });

  it("selection pushes and drops camera params", () => {
    t.s().commitCamera("tree", { tz: 1, dx: 0, dy: 0 });
    t.advance(CAMERA_DEBOUNCE_MS);
    t.s().select({ kind: "language", glottocode: "nucl1301" });
    expect(t.log.at(-1)).toEqual({ href: "/language/nucl1301", replace: false });
  });

  it("lens switch pushes; tab, dialects and locale replace", () => {
    t.s().select({ kind: "language", glottocode: "nucl1301" });
    t.s().setLens("map");
    expect(t.log.at(-1)).toEqual({ href: "/language/nucl1301?lens=map", replace: false });
    t.s().setTab("speakers");
    expect(t.log.at(-1)).toEqual({ href: "/language/nucl1301?lens=map&tab=speakers", replace: true });
    t.s().setMapDialects(true);
    expect(t.log.at(-1)?.replace).toBe(true);
    t.s().setLocale("fa");
    expect(t.log.at(-1)).toEqual({
      href: "/language/nucl1301?lens=map&tab=speakers&dialects=1&lang=fa",
      replace: true,
    });
  });

  it("lump pushes", () => {
    t.s().setLumped("persian", true);
    expect(t.log.at(-1)).toEqual({ href: "/?lump=persian", replace: false });
    t.s().setLumped("arabic", true);
    expect(t.log.at(-1)?.href).toBe("/?lump=arabic,persian");
  });

  it("new selections keep lens, lump and lang", () => {
    t.s().setLumped("persian", true);
    t.s().setLens("map");
    t.s().setLocale("tr");
    t.s().select({ kind: "family", glottocode: "turk1311" });
    expect(t.log.at(-1)?.href).toBe("/family/turk1311?lens=map&lump=persian&lang=tr");
  });

  it("selecting the current entity again does not push", () => {
    t.s().select({ kind: "language", glottocode: "nucl1301" });
    const n = t.log.length;
    t.s().select({ kind: "language", glottocode: "nucl1301" });
    expect(t.log.length).toBe(n);
  });
});

describe("camera writes (spec 3.3)", () => {
  it("replace after 400 ms of quiet, never push", () => {
    const t = setup("/family/turk1311");
    t.s().commitCamera("tree", { tz: 1.5, dx: 0.1, dy: -0.2 });
    t.advance(399);
    expect(t.replaced).toEqual([]);
    t.advance(1);
    expect(t.replaced).toEqual(["/family/turk1311?tz=1.50&tc=0.10,-0.20"]);
    expect(t.log).toEqual([]);
    expect(t.s().treeCamera).toEqual({ tz: 1.5, dx: 0.1, dy: -0.2 });
  });

  it("writes at most once per second during long interactions", () => {
    const t = setup("/");
    for (let i = 0; i < 30; i++) {
      t.s().commitCamera("tree", { tz: i / 10, dx: 0, dy: 0 });
      t.advance(100);
    }
    t.advance(2000);
    // 3 s of commits every 100 ms: the debounce holds every write until the quiet period.
    expect(t.replaced.length).toBeLessThanOrEqual(4);
    expect(t.replaced.at(-1)).toBe("/?tz=2.90");
  });

  it("a camera at the default fit removes the params", () => {
    const t = setup("/?tz=2.00");
    t.s().commitCamera("tree", { tz: 0.03, dx: 0.01, dy: -0.01 });
    t.advance(500);
    expect(t.replaced).toEqual(["/"]);
  });

  it("waits while a flight runs", () => {
    const t = setup("/");
    t.s().setFlight("tree", true);
    t.s().commitCamera("tree", { tz: 1, dx: 0, dy: 0 });
    t.advance(1200);
    expect(t.replaced).toEqual([]);
    t.s().setFlight("tree", false);
    t.advance(500);
    expect(t.replaced).toEqual(["/?tz=1.00"]);
  });

  it("flushes synchronously before a push, so Back lands on the old camera", () => {
    const t = setup("/language/nucl1301");
    t.s().commitCamera("tree", { tz: 2, dx: 0, dy: 0 });
    t.s().commitCamera("map", { zoom: 4.2, lat: 39, lon: 35 });
    t.s().select({ kind: "family", glottocode: "turk1311" });
    expect(t.replaced).toEqual(["/language/nucl1301?tz=2.00&map=4.20/39.000/35.000"]);
    expect(t.log.at(-1)).toEqual({ href: "/family/turk1311", replace: false });
  });

  it("a pending camera is dropped when the reader goes back", () => {
    const t = setup("/");
    t.s().commitCamera("tree", { tz: 2, dx: 0, dy: 0 });
    t.s().hydrateFromUrl(parseShellUrl("/family/indo1319", "").state, "pop");
    t.advance(1000);
    expect(t.replaced).toEqual([]);
    expect(t.s().cameraRestore).toBe(2);
  });
});

describe("session state", () => {
  it("a search or Go deeper selection opens the sheet from peek to half; a canvas tap keeps it", () => {
    const t = setup("/");
    t.s().select({ kind: "language", glottocode: "nucl1301" }, { source: "canvas" });
    expect(t.s().sheetStop).toBe("peek");
    t.s().select({ kind: "language", glottocode: "stan1290" }, { source: "search" });
    expect(t.s().sheetStop).toBe("half");
    expect(t.s().pendingFocus).toBe("/language/stan1290");
    expect(t.s().consumeFocus("/language/stan1290")).toBe(true);
    expect(t.s().pendingFocus).toBeNull();
  });

  it("announce re-announces equal text with a new id", () => {
    const t = setup("/");
    t.s().announce("Map view.");
    const a = t.s().announcement.id;
    t.s().announce("Map view.");
    expect(t.s().announcement.id).toBe(a + 1);
  });
});
