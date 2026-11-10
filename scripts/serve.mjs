#!/usr/bin/env node
// Serve the built app like production will: static files from apps/web/build/client, and the
// pipeline output from data/build at /data/ (in production that is object storage).
//
//   node scripts/serve.mjs [port]      default port 4173
//
// Unknown paths get the SPA fallback page, as a static host would be configured to do.

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import sirv from "sirv";

const ROOT = path.resolve(import.meta.dirname, "..");
const port = Number(process.argv[2] ?? 4173);
const clientDir = path.join(ROOT, "apps/web/build/client");
const dataDir = path.join(ROOT, "data/build");

if (!fs.existsSync(clientDir)) {
  console.error("serve: apps/web/build/client is missing. Run `pnpm build` first.");
  process.exit(1);
}

const fallback = path.join(clientDir, "__spa-fallback.html");
const app = sirv(clientDir, { etag: true });
const data = sirv(dataDir, { etag: true, dev: false });

const server = http.createServer((req, res) => {
  const notFound = () => {
    if (fs.existsSync(fallback)) {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      fs.createReadStream(fallback).pipe(res);
    } else {
      res.writeHead(404).end("Not found");
    }
  };
  if (req.url?.startsWith("/data/")) {
    req.url = req.url.slice("/data".length);
    data(req, res, () => res.writeHead(404).end("Not found"));
    return;
  }
  app(req, res, notFound);
});

server.listen(port, () => console.log(`serve: http://localhost:${port} (data from ${dataDir})`));
