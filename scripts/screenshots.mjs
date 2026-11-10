#!/usr/bin/env node
// Screenshots of every page for owner review (KICKOFF_PROMPT.md: 1440x900 and 390x844).
// Serves the built app (run `pnpm build` first) and writes compact JPEGs.
//
//   node scripts/screenshots.mjs <out-dir> [path ...]
//
// Default paths: every prerendered page. Each path is shot in English (night and parchment)
// and in Persian (night, right to left). Console errors are listed at the end and make the
// script exit 1, so a screenshot run doubles as a smoke test.

/* global document -- used only inside page.evaluate callbacks, which run in the browser */

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const ROOT = path.resolve(import.meta.dirname, "..");
const outDir = path.resolve(process.argv[2] ?? "screenshots");
const paths = process.argv.slice(3).length
  ? process.argv.slice(3)
  : ["/", "/design", "/spike/tree", "/spike/map"];
const PORT = 4310;

const viewports = [
  { name: "1440", width: 1440, height: 900 },
  { name: "390", width: 390, height: 844, isMobile: true, hasTouch: true },
];
const variants = [
  { name: "en-night", lang: "en", scheme: "dark" },
  { name: "en-parchment", lang: "en", scheme: "light" },
  { name: "fa-night", lang: "fa", scheme: "dark" },
];

const slug = (p) => (p === "/" ? "home" : p.replace(/^\//, "").replace(/\//g, "-"));

// Same server as `pnpm --filter web preview`: the built app plus pipeline data at /data/.
const server = spawn(process.execPath, [path.join(ROOT, "scripts/serve.mjs"), String(PORT)], {
  cwd: ROOT,
  stdio: "ignore",
});

async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(`http://localhost:${PORT}/`)).ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`static server did not start on port ${PORT}; did you run pnpm build?`);
}

const errors = [];
try {
  await waitForServer();
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  for (const vp of viewports) {
    for (const v of variants) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        isMobile: vp.isMobile ?? false,
        hasTouch: vp.hasTouch ?? false,
        colorScheme: v.scheme,
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      page.on("console", (m) => m.type() === "error" && errors.push(`${page.url()}: ${m.text()}`));
      page.on("pageerror", (e) => errors.push(`${page.url()}: ${e.message}`));
      for (const p of paths) {
        const url = `http://localhost:${PORT}${p}${v.lang === "en" ? "" : `?lang=${v.lang}`}`;
        await page.goto(url, { waitUntil: "networkidle" });
        if (v.lang !== "en") await page.waitForFunction((l) => document.documentElement.lang === l, v.lang);
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(400); // let canvases settle
        const file = path.join(outDir, `${slug(p)}-${vp.name}-${v.name}.jpg`);
        await page.screenshot({ path: file, type: "jpeg", quality: 72 });
        console.log(`saved ${path.relative(ROOT, file)}`);
      }
      await context.close();
    }
  }
  await browser.close();
} finally {
  server.kill();
}

if (errors.length) {
  console.error(`\n${errors.length} console error(s):\n${errors.join("\n")}`);
  process.exit(1);
}
