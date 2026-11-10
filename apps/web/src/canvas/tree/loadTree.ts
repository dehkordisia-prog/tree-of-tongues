// Load /data/tree.json and lay it out in a Web Worker. Never throws: a missing file is a state.

import type { FamilyMismatch } from "./family";
import type { TreeLayout } from "./layout";
import type { WorkerReply } from "./layout.worker";

export const TREE_URL = "/data/tree.json";

export type LoadResult =
  | {
      ok: true;
      layout: TreeLayout;
      timings: { fetchMs: number; parseMs: number; layoutMs: number; totalMs: number };
      mismatches: FamilyMismatch[];
      format: string | null;
    }
  | { ok: false; reason: "missing" | "invalid"; status: number | null };

export function loadTree(url = TREE_URL): Promise<LoadResult> {
  return new Promise((resolve) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL("./layout.worker.ts", import.meta.url), { type: "module" });
    } catch {
      resolve({ ok: false, reason: "invalid", status: null });
      return;
    }
    worker.onmessage = (e: MessageEvent<WorkerReply>) => {
      worker.terminate();
      resolve(e.data);
    };
    worker.onerror = () => {
      worker.terminate();
      resolve({ ok: false, reason: "invalid", status: null });
    };
    worker.postMessage({ url });
  });
}
