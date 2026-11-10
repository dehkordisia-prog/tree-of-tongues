import { useEffect, useMemo, useState, type ComponentType } from "react";
import { Link, useSearchParams } from "react-router";

import { installBenchHook } from "@/canvas/tree/benchHook";
import type { TreeViewProps } from "@/canvas/tree/TreeView";

export function meta() {
  return [{ title: "Tree spike · Tree of Tongues" }];
}

// Phase 0 spike (decision D-006): the same layout, camera and level of detail, drawn by PixiJS or by
// deck.gl. ?renderer=pixi (default) or ?renderer=deck. ?bench=1 installs window.__bench; ?stress=1 turns semantic zoom nearly off to draw every languoid.
// TreeView is imported on the client only, so neither renderer reaches the app shell or the prerender.
export default function TreeSpike() {
  const [params] = useSearchParams();
  const renderer = params.get("renderer") === "deck" ? "deck" : "pixi";
  const bench = params.get("bench") === "1";
  const stress = params.get("stress") === "1";
  const [View, setView] = useState<ComponentType<TreeViewProps> | null>(null);
  const initialFocus = useMemo(() => (typeof window === "undefined" ? null : params.get("focus")), [params]);

  useEffect(() => {
    // Install early so window.__bench exists before the view chunk loads. TreeView calls the same idempotent function.
    const h = bench ? installBenchHook() : null;
    return () => h?.remove();
  }, [bench]);

  useEffect(() => {
    let alive = true;
    import("@/canvas/tree/TreeView").then((m) => alive && setView(() => m.default));
    return () => {
      alive = false;
    };
  }, []);

  const other = new URLSearchParams(params);
  other.set("renderer", renderer === "pixi" ? "deck" : "pixi");
  other.delete("focus");
  const otherHref = `?${other.toString()}`;

  return (
    <main className="px-gutter py-6">
      <h1 className="text-title">Tree spike</h1>
      {View ? (
        <View key={renderer} renderer={renderer} bench={bench} stress={stress} initialFocus={initialFocus} otherRendererHref={otherHref} />
      ) : (
        <p role="status" className="mt-4 text-ink-muted">
          Loading the tree...
        </p>
      )}
      <nav aria-label="More workbenches" className="mt-6">
        <ul className="flex flex-wrap gap-x-6">
          <li>
            <Link to="/">Back to the start</Link>
          </li>
          <li>
            <Link to="/spike/map">Map spike</Link>
          </li>
          <li>
            <Link to="/design">Design system</Link>
          </li>
        </ul>
      </nav>
    </main>
  );
}
