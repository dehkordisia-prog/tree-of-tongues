// window.__bench contract (shared with the map spike). Installed when the URL has bench=1.
//
//   ready: resolves after the first frame is drawn with all data loaded (rejects if the data is missing)
//   run(): plays the fixed 20 s camera path and resolves with the frame statistics

import type { BenchResult } from "./bench";

export interface BenchApi {
  ready: Promise<void>;
  run(): Promise<BenchResult>;
}

// Not declared on the global Window type: the map spike declares window.__bench with its own result type.
type BenchWindow = { __bench?: BenchApi };
const host = (): BenchWindow => window as unknown as BenchWindow;

export interface BenchHook {
  resolveReady(): void;
  rejectReady(reason: string): void;
  setRunner(run: () => Promise<BenchResult>): void;
  remove(): void;
}

let current: BenchHook | null = null;

/** Idempotent: the route and the view both call it, whichever runs first installs window.__bench. */
export function installBenchHook(): BenchHook {
  if (current) return current;
  let resolveReady!: () => void;
  let rejectReady!: (e: Error) => void;
  const ready = new Promise<void>((res, rej) => {
    resolveReady = res;
    rejectReady = rej;
  });
  // The caller may never await `ready` if it only reads `run`; avoid an unhandled rejection.
  ready.catch(() => {});
  let runner: (() => Promise<BenchResult>) | null = null;
  const api: BenchApi = {
    ready,
    async run() {
      await ready;
      if (!runner) throw new Error("bench runner is not set");
      return runner();
    },
  };
  host().__bench = api;
  current = {
    resolveReady,
    rejectReady: (reason) => rejectReady(new Error(reason)),
    setRunner: (r) => {
      runner = r;
    },
    remove: () => {
      if (host().__bench === api) delete host().__bench;
      current = null;
    },
  };
  return current;
}
