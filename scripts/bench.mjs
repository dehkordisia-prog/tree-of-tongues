#!/usr/bin/env node
// Phase 0 renderer benchmark (D-006). Measures each spike one after the other, never in parallel,
// in a headed Chromium with the GPU enabled (headless Chromium may fall back to software WebGL,
// which would make fps meaningless). Run `pnpm build` first; data comes from data/build.
//
//   node scripts/bench.mjs <out-dir> [target ...]
//
// Targets: tree-pixi, tree-deck, map (default: all three). Each runs in two conditions:
//   desktop  1440x900, devicePixelRatio 1, no throttling
//   mobile   390x844, devicePixelRatio 2.625, 4x CPU throttling (a proxy, not a real phone)
// Each page exposes window.__bench = { ready, run() } (contract in the spike briefs).
// Memory: JS heap from the DevTools protocol after the run, and the working set of every process
// of this browser profile from Windows (renderer, GPU and browser processes together).

import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "@playwright/test";

const ROOT = path.resolve(import.meta.dirname, "..");
const outDir = path.resolve(process.argv[2] ?? "bench-results");
const PORT = 4320;
const targets = {
  "tree-pixi": "/spike/tree?renderer=pixi&bench=1",
  "tree-deck": "/spike/tree?renderer=deck&bench=1",
  map: "/spike/map?bench=1",
};
const chosen = process.argv.slice(3).length ? process.argv.slice(3) : Object.keys(targets);
const conditions = [
  { name: "desktop", width: 1440, height: 900, dpr: 1, cpu: 1, mobile: false },
  { name: "mobile-proxy", width: 390, height: 844, dpr: 2.625, cpu: 4, mobile: true },
];

function profileWorkingSetMB(profileDir) {
  if (process.platform !== "win32") return null;
  const needle = profileDir.replace(/'/g, "''");
  const ps = `(Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*${needle}*' } | Measure-Object WorkingSetSize -Sum).Sum`;
  const out = execFileSync("powershell", ["-NoProfile", "-Command", ps], { encoding: "utf8" }).trim();
  return out ? Math.round(Number(out) / 1048576) : null;
}

const server = spawn(process.execPath, [path.join(ROOT, "scripts/serve.mjs"), String(PORT)], {
  cwd: ROOT,
  stdio: "ignore",
});
for (let i = 0; i < 50; i++) {
  try {
    if ((await fetch(`http://localhost:${PORT}/data/tree.json`, { method: "HEAD" })).ok) break;
  } catch {
    // not up yet
  }
  await new Promise((r) => setTimeout(r, 200));
}

const results = [];
try {
  for (const target of chosen) {
    for (const c of conditions) {
      const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), "tot-bench-"));
      const context = await chromium.launchPersistentContext(profileDir, {
        headless: false,
        viewport: { width: c.width, height: c.height },
        deviceScaleFactor: c.dpr,
        isMobile: c.mobile,
        hasTouch: c.mobile,
        args: ["--ignore-gpu-blocklist", "--enable-gpu-rasterization", "--disable-renderer-backgrounding"],
      });
      const page = context.pages()[0] ?? (await context.newPage());
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
      const cdp = await context.newCDPSession(page);
      await cdp.send("Performance.enable");

      await page.goto(`http://localhost:${PORT}${targets[target]}`, { waitUntil: "load" });
      await page.waitForFunction(() => globalThis.__bench, null, { timeout: 60_000 });
      await page.evaluate(() => globalThis.__bench.ready);
      const gpu = await page.evaluate(() => {
        const gl = globalThis.document.createElement("canvas").getContext("webgl2");
        const ext = gl?.getExtension("WEBGL_debug_renderer_info");
        return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "unknown";
      });
      if (c.cpu > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: c.cpu });
      const bench = await page.evaluate(() => globalThis.__bench.run());
      if (c.cpu > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
      await cdp.send("HeapProfiler.collectGarbage").catch(() => {});
      const { metrics } = await cdp.send("Performance.getMetrics");
      const heap = metrics.find((m) => m.name === "JSHeapUsedSize")?.value ?? 0;
      const row = {
        target,
        condition: c.name,
        ...bench,
        jsHeapMB: Math.round(heap / 1048576),
        browserWorkingSetMB: profileWorkingSetMB(profileDir),
        gpu,
        consoleErrors: errors,
      };
      results.push(row);
      console.log(
        `${target} ${c.name}: p50 ${bench.fpsP50?.toFixed?.(1)} fps, p5 ${bench.fpsP5?.toFixed?.(1)} fps, heap ${row.jsHeapMB} MB, browser ${row.browserWorkingSetMB} MB`,
      );
      await context.close();
      fs.rmSync(profileDir, { recursive: true, force: true });
    }
  }
} finally {
  server.kill();
}

fs.mkdirSync(outDir, { recursive: true });
const meta = {
  date: new Date().toISOString(),
  machine: {
    cpu: os.cpus()[0]?.model,
    cores: os.cpus().length,
    memGB: Math.round(os.totalmem() / 1073741824),
  },
  platform: `${os.type()} ${os.release()}`,
  conditions,
};
fs.writeFileSync(path.join(outDir, "bench.json"), JSON.stringify({ meta, results }, null, 2) + "\n");

const f = (v, d = 1) => (typeof v === "number" ? v.toFixed(d) : "n/a");
const lines = [
  `Measured ${meta.date} on ${meta.machine.cpu} (${meta.machine.cores} threads, ${meta.machine.memGB} GB), ${meta.platform}.`,
  `GPU: ${[...new Set(results.map((r) => r.gpu))].join("; ")}.`,
  "",
  "| Target | Condition | Nodes | fps p50 | fps p5 | Worst frame ms | First frame ms | Layout ms | JS heap MB | Browser MB |",
  "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ...results.map(
    (r) =>
      `| ${r.target} | ${r.condition} | ${r.nodes ?? "n/a"} | ${f(r.fpsP50)} | ${f(r.fpsP5)} | ${f(r.worstFrameMs, 0)} | ${f(r.firstFrameMs, 0)} | ${f(r.layoutMs, 0)} | ${r.jsHeapMB} | ${r.browserWorkingSetMB ?? "n/a"} |`,
  ),
];
fs.writeFileSync(path.join(outDir, "bench.md"), lines.join("\n") + "\n");
console.log(`\n${lines.join("\n")}`);
if (results.some((r) => r.consoleErrors.length)) {
  console.error(
    "\nConsole errors during the run:",
    results.flatMap((r) => r.consoleErrors),
  );
  process.exit(1);
}
