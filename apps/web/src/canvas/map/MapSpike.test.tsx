import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DataMissingError, fetchJson } from "./data";
import MapSpike from "./MapSpike";

beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("missing data", () => {
  it("shows an accessible status and loads no map library", async () => {
    // A dev server answers unknown paths with its HTML page and status 200.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<!doctype html>", { status: 200, headers: { "content-type": "text/html" } })),
    );
    render(<MapSpike />);
    const status = await screen.findByRole("status");
    expect(status.textContent).toContain("Data not built yet. Run uv run pipeline build.");
    expect(document.querySelector("canvas")).toBeNull();
  });

  it("treats a 404 and a network error the same way", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 404 })));
    await expect(fetchJson("/data/x.json")).rejects.toBeInstanceOf(DataMissingError);
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("offline"))));
    await expect(fetchJson("/data/x.json")).rejects.toBeInstanceOf(DataMissingError);
  });

  it("parses JSON served with a geo+json content type", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response('{"a":1}', { status: 200, headers: { "content-type": "application/geo+json" } })),
    );
    await expect(fetchJson("/data/x.geojson")).resolves.toEqual({ a: 1 });
  });
});
