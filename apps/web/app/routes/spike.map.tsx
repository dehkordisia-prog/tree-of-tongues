import { useEffect, useState, type ComponentType } from "react";
import { Link } from "react-router";

import "maplibre-gl/dist/maplibre-gl.css";

import { ThemeToggle } from "@/design/ThemeToggle";
import { installBenchStub, wantsBench } from "@/canvas/map/bench";
import { S } from "@/canvas/map/strings";
import { useLocale } from "@/i18n/locale";

export function meta() {
  return [{ title: "Map spike · Tree of Tongues" }];
}

// With ?bench=1 the benchmark handle exists as early as possible, before the map chunk loads.
if (typeof window !== "undefined" && wantsBench(window.location.search)) installBenchStub();

// The shell (heading, links, theme) is prerendered. The map body, with MapLibre and deck.gl behind
// a second dynamic import, loads on the client only, so none of it is in the app-shell bundle.
export default function MapSpike() {
  const [Body, setBody] = useState<ComponentType | null>(null);
  const locale = useLocale();
  const english = locale === "en";

  useEffect(() => {
    let cancelled = false;
    void import("@/canvas/map/MapSpike").then((m) => {
      if (!cancelled) setBody(() => m.default);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex min-h-dvh flex-col bg-canvas lg:h-dvh lg:overflow-hidden">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-1 border-b border-line px-gutter py-2">
        <h1 className="font-display text-title" lang={english ? undefined : "en"} dir={english ? undefined : "ltr"}>
          {S.title}
        </h1>
        <p className="hidden min-w-0 flex-1 basis-80 text-small text-ink-muted sm:block" lang={english ? undefined : "en"} dir={english ? undefined : "ltr"}>
          {S.intro}
        </p>
        <Link to="/" className="inline-flex min-h-target items-center text-small" lang={english ? undefined : "en"} dir={english ? undefined : "ltr"}>
          {S.back}
        </Link>
        <ThemeToggle />
      </header>
      {Body ? (
        <Body />
      ) : (
        <p role="status" className="px-gutter py-8 text-ink-muted">
          {S.loading}
        </p>
      )}
    </div>
  );
}
