#!/usr/bin/env node
// Fetch font files that are too large to keep in git (owner decision, docs/DECISIONS.md D-015).
// scripts/fonts.lock.json pins each npm package, its registry integrity (sha512) and the
// sha256 of every file we use. Files already present with the right hash are skipped,
// so this is fast after the first run.
//
//   node scripts/fetch-fonts.mjs          fetch missing or changed files, verify all
//   node scripts/fetch-fonts.mjs --check  verify only, exit 1 if anything is missing or wrong
//   node scripts/fetch-fonts.mjs --lock   rewrite file hashes in the lock from the verified tarball

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const ROOT = path.resolve(import.meta.dirname, "..");
const LOCK = path.join(ROOT, "scripts", "fonts.lock.json");
const mode = process.argv.includes("--check") ? "check" : process.argv.includes("--lock") ? "lock" : "fetch";

const sha256 = (buf) => crypto.createHash("sha256").update(buf).digest("hex");

function fileOk(file, expected) {
  try {
    return sha256(fs.readFileSync(file)) === expected;
  } catch {
    return false;
  }
}

// Minimal reader for npm's gzipped ustar tarballs: returns Map<path, Buffer> of regular files.
function untar(gz) {
  const tar = zlib.gunzipSync(gz);
  const files = new Map();
  let offset = 0;
  let longName = null;
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((b) => b === 0)) break;
    const field = (start, len) =>
      header
        .subarray(start, start + len)
        .toString("utf8")
        .replace(/\0.*$/s, "");
    const size = parseInt(field(124, 12).trim() || "0", 8);
    const type = field(156, 1) || "0";
    const prefix = field(345, 155);
    let name = longName ?? (prefix ? `${prefix}/${field(0, 100)}` : field(0, 100));
    longName = null;
    const body = tar.subarray(offset + 512, offset + 512 + size);
    if (type === "L") longName = body.toString("utf8").replace(/\0.*$/s, "");
    else if (type === "0") files.set(name, Buffer.from(body));
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  return files;
}

async function download(pkg) {
  const res = await fetch(pkg.tarball, { headers: { "user-agent": "tree-of-tongues-fetch-fonts" } });
  if (!res.ok) throw new Error(`${pkg.name}@${pkg.version}: HTTP ${res.status} for ${pkg.tarball}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const [algo, expected] = pkg.integrity.split("-");
  const actual = crypto.createHash(algo).update(buf).digest("base64");
  if (actual !== expected) throw new Error(`${pkg.name}@${pkg.version}: tarball integrity mismatch`);
  return untar(buf);
}

const lock = JSON.parse(fs.readFileSync(LOCK, "utf8"));
let problems = 0;

for (const pkg of lock.packages) {
  const dest = path.join(ROOT, pkg.dest);
  const names = Object.keys(pkg.files);
  const stale = mode === "lock" ? names : names.filter((n) => !fileOk(path.join(dest, n), pkg.files[n]));

  if (stale.length === 0) {
    console.log(`fonts: ${pkg.name}@${pkg.version} ok (${names.length} files)`);
    continue;
  }
  if (mode === "check") {
    console.error(
      `fonts: ${pkg.name}@${pkg.version}: ${stale.length} file(s) missing or changed in ${pkg.dest}`,
    );
    problems += stale.length;
    continue;
  }

  const entries = await download(pkg);
  fs.mkdirSync(dest, { recursive: true });
  for (const name of stale) {
    const data = entries.get(`${pkg.source_dir}/${name}`);
    if (!data) throw new Error(`${pkg.name}@${pkg.version}: ${pkg.source_dir}/${name} not in tarball`);
    if (mode === "lock") pkg.files[name] = sha256(data);
    else if (sha256(data) !== pkg.files[name]) throw new Error(`${name}: sha256 does not match the lock`);
    fs.writeFileSync(path.join(dest, name), data);
  }
  console.log(`fonts: ${pkg.name}@${pkg.version} wrote ${stale.length} file(s) to ${pkg.dest}`);
}

if (mode === "lock") fs.writeFileSync(LOCK, JSON.stringify(lock, null, 2) + "\n");
if (problems) {
  console.error("fonts: run `pnpm fonts` to fetch them.");
  process.exit(1);
}
