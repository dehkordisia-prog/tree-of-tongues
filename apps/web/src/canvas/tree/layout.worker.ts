// Web Worker: fetch tree.json, parse it and pack the circles off the main thread.
/// <reference lib="webworker" />

import { familyMismatches, type FamilyMismatch } from "./family";
import { computeLayout, type TreeFile, type TreeLayout } from "./layout";

export interface WorkerRequest {
  url: string;
}
export type WorkerReply =
  | {
      ok: true;
      layout: TreeLayout;
      timings: { fetchMs: number; parseMs: number; layoutMs: number; totalMs: number };
      mismatches: FamilyMismatch[];
      format: string | null;
    }
  | { ok: false; reason: "missing" | "invalid"; status: number | null };

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const t0 = performance.now();
  try {
    const res = await fetch(e.data.url);
    if (!res.ok) {
      (self as unknown as Worker).postMessage({ ok: false, reason: "missing", status: res.status } satisfies WorkerReply);
      return;
    }
    const text = await res.text();
    const t1 = performance.now();
    let file: TreeFile;
    try {
      file = JSON.parse(text) as TreeFile;
      if (!Array.isArray(file.nodes) || file.nodes.length === 0) throw new Error("no nodes");
    } catch {
      // A dev server may answer a missing file with an HTML page and status 200.
      (self as unknown as Worker).postMessage({ ok: false, reason: "missing", status: res.status } satisfies WorkerReply);
      return;
    }
    const t2 = performance.now();
    const layout = computeLayout(file);
    const t3 = performance.now();
    const mismatches = familyMismatches(file.nodes.map((r) => ({ glottocode: r[0], name: r[3] })));
    const reply: WorkerReply = {
      ok: true,
      layout,
      timings: { fetchMs: t1 - t0, parseMs: t2 - t1, layoutMs: t3 - t2, totalMs: t3 - t0 },
      mismatches,
      format: typeof file.format === "string" ? file.format : null,
    };
    const transfer = [
      layout.parent.buffer,
      layout.level.buffer,
      layout.depth.buffer,
      layout.childStart.buffer,
      layout.childList.buffer,
      layout.languages.buffer,
      layout.family.buffer,
      layout.x.buffer,
      layout.y.buffer,
      layout.r.buffer,
      layout.l1Max.buffer,
      layout.anyMax.buffer,
      layout.selfX.buffer,
      layout.selfY.buffer,
    ];
    (self as unknown as Worker).postMessage(reply, transfer);
  } catch {
    (self as unknown as Worker).postMessage({ ok: false, reason: "invalid", status: null } satisfies WorkerReply);
  }
};
