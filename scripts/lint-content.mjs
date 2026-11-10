#!/usr/bin/env node
// Content lint for Tree of Tongues (rules from docs/CONTENT_STYLE.md).
//   1. No em dash (U+2014) in UI copy or content.
//   2. In English text the language is called "Persian". The ASCII word "Farsi" is allowed
//      only as a search alias or inside a romanized endonym: lines that contain "alias",
//      "endonym" or "lint-allow" are skipped, and "fārsi" (with a macron) never matches.
//
// Hook mode (default): reads the Claude Code PostToolUse JSON from stdin and checks the
// edited file. Exit code 2 returns the message to Claude so it fixes the text.
// CLI mode: `node scripts/lint-content.mjs --all` scans every file in scope (exit 1 on problems).

import fs from "node:fs";
import path from "node:path";

const ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const SCOPES = ["content", "apps/web/src", "apps/web/public/locales", "locales"];
const EXTENSIONS = new Set([".md", ".mdx", ".json", ".yaml", ".yml", ".ts", ".tsx", ".js", ".jsx", ".txt", ".html"]);
const EM_DASH = String.fromCharCode(0x2014);
const FARSI = /\bfarsi\b/i;
const SKIP_LINE = /(alias|endonym|lint-allow)/i;

function relative(file) {
  return path.relative(ROOT, path.resolve(file)).split(path.sep).join("/");
}

function inScope(file) {
  const rel = relative(file);
  if (rel.startsWith("..") || rel.includes("node_modules/")) return false;
  if (!EXTENSIONS.has(path.extname(rel).toLowerCase())) return false;
  return SCOPES.some((scope) => rel === scope || rel.startsWith(scope + "/"));
}

function check(file) {
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    return [];
  }
  const rel = relative(file);
  const problems = [];
  text.split(/\r?\n/).forEach((line, index) => {
    const where = `${rel}:${index + 1}`;
    if (line.includes(EM_DASH)) {
      problems.push(`${where}: em dash found. Rewrite with a comma, colon, parentheses or two sentences.`);
    }
    if (FARSI.test(line) && !SKIP_LINE.test(line)) {
      problems.push(`${where}: "Farsi" used as a name. Write "Persian" in English text (Farsi is allowed only as a search alias).`);
    }
  });
  return problems;
}

function walk(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (inScope(full)) out.push(full);
  }
  return out;
}

function report(problems, exitCode) {
  if (problems.length === 0) process.exit(0);
  console.error(`content-lint: ${problems.length} problem(s)\n${problems.join("\n")}`);
  process.exit(exitCode);
}

if (process.argv.includes("--all")) {
  const files = SCOPES.flatMap((scope) => walk(path.join(ROOT, scope)));
  report(files.flatMap(check), 1);
} else {
  let input = "";
  try {
    input = fs.readFileSync(0, "utf8");
  } catch {
    process.exit(0);
  }
  let filePath;
  try {
    filePath = JSON.parse(input)?.tool_input?.file_path;
  } catch {
    process.exit(0);
  }
  if (!filePath || !inScope(filePath)) process.exit(0);
  report(check(filePath), 2);
}
