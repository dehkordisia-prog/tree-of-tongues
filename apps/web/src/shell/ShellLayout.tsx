// The persistent shell (spec 1.2): top bar, breadcrumbs, the canvas with both lenses, time strip,
// footer strip, and the Inspector (right panel from 1024 px, bottom sheet below). Entity routes
// render into the Inspector through <Outlet>, so the canvas never remounts on navigation.

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent as RPointerEvent,
  type ReactNode,
} from "react";

import { shellStore, useShell, type SheetStop } from "@/state/shell";

import { CanvasHost } from "./Canvas";
import { Breadcrumbs, FooterStrip, HelpDialog, LiveRegion, SkipLinks, TimeStrip, TopBar } from "./Chrome";
import { CommandPalette } from "./CommandPalette";
import { INSPECTOR_HEADING_ID } from "./inspector/parts";
import { Icon, useT } from "./T";

const PHONE = "(max-width: 1023.98px)";

function usePhone(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(PHONE);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(PHONE).matches,
    () => false,
  );
}

/** Ctrl+K or Cmd+K opens search from anywhere, including text fields (spec 1.4). */
function useGlobalKeys(phone: boolean) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = shellStore.getState();
      if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        if (s.paletteOpen) {
          const input = document.querySelector<HTMLInputElement>('[role="dialog"] input[role="combobox"]');
          input?.select();
        } else s.openPalette();
        return;
      }
      if (
        e.key === "Escape" &&
        phone &&
        s.sheetStop === "full" &&
        !s.paletteOpen &&
        !s.helpOpen &&
        !e.defaultPrevented
      ) {
        const layer = document.querySelector("[data-radix-popper-content-wrapper]");
        if (!layer) {
          e.preventDefault();
          s.setSheetStop("half");
        }
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [phone]);
}

const STOPS: SheetStop[] = ["peek", "half", "full"];

function Sheet({ children }: { children: ReactNode }) {
  const stop = useShell((s) => s.sheetStop);
  const t = useT();
  const dir = useRef<1 | -1>(1);
  const drag = useRef<{ y0: number; h0: number; t0: number; moved: boolean } | null>(null);
  const [dragH, setDragH] = useState<number | null>(null);
  const ref = useRef<HTMLElement>(null);
  const cycle = () => {
    const i = STOPS.indexOf(stop);
    if (i === STOPS.length - 1) dir.current = -1;
    if (i === 0) dir.current = 1;
    shellStore.getState().setSheetStop(STOPS[i + dir.current]!);
  };
  const heights = () => {
    const vh = window.innerHeight;
    return { peek: 112, half: vh * 0.5, full: vh - 56 };
  };
  const onDown = (e: RPointerEvent<HTMLButtonElement>) => {
    const h = ref.current?.getBoundingClientRect().height ?? 112;
    drag.current = { y0: e.clientY, h0: h, t0: performance.now(), moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: RPointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d) return;
    const dy = e.clientY - d.y0;
    if (Math.abs(dy) > 6) d.moved = true;
    if (d.moved) setDragH(Math.max(80, Math.min(heights().full, d.h0 - dy)));
  };
  const onUp = (e: RPointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (!d.moved) {
      setDragH(null);
      return; // a tap: the click handler cycles
    }
    const h = d.h0 - (e.clientY - d.y0);
    const v = (d.y0 - e.clientY) / Math.max(1, performance.now() - d.t0); // px per ms, up is positive
    const hs = heights();
    let best: SheetStop = "peek";
    const projected = h + v * 200;
    for (const s of STOPS) if (Math.abs(hs[s] - projected) < Math.abs(hs[best] - projected)) best = s;
    setDragH(null);
    shellStore.getState().setSheetStop(best);
    e.preventDefault();
  };
  const label = t(`sheet.${stop}`);
  return (
    <aside
      ref={ref}
      aria-labelledby={INSPECTOR_HEADING_ID}
      data-testid="inspector"
      className="tt-sheet fixed inset-x-0 bottom-0 z-30 flex flex-col rounded-t-xl border-t border-line-strong bg-surface shadow-overlay"
      data-stop={stop}
      style={dragH !== null ? { height: dragH, transition: "none" } : undefined}
    >
      <button
        type="button"
        className="mx-auto flex min-h-target w-full max-w-xs shrink-0 items-center justify-center"
        aria-label={`${t("sheet.handle")}. ${label}`}
        onClick={(e) => {
          if (e.detail === 0 || !drag.current) cycle();
        }}
        onKeyDown={(e) => {
          const i = STOPS.indexOf(stop);
          if (e.key === "ArrowUp" && i < 2) {
            e.preventDefault();
            shellStore.getState().setSheetStop(STOPS[i + 1]!);
          } else if (e.key === "ArrowDown" && i > 0) {
            e.preventDefault();
            shellStore.getState().setSheetStop(STOPS[i - 1]!);
          }
        }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={() => {
          drag.current = null;
          setDragH(null);
        }}
        data-testid="sheet-handle"
        style={{ touchAction: "none" }}
      >
        <span aria-hidden="true" className="h-1.5 w-12 rounded-pill bg-line-strong" />
      </button>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        {children}
      </div>
    </aside>
  );
}

function SidePanel({ children }: { children: ReactNode }) {
  const collapsed = useShell((s) => s.inspectorCollapsed);
  const t = useT();
  return (
    <aside
      aria-labelledby={collapsed ? undefined : INSPECTOR_HEADING_ID}
      aria-label={collapsed ? t("inspector.label") : undefined}
      data-testid="inspector"
      className={
        collapsed
          ? "flex w-11 shrink-0 flex-col items-center border-s border-line bg-surface pt-2"
          : "tt-side flex w-[clamp(360px,30vw,440px)] shrink-0 flex-col border-s border-line bg-surface shadow-overlay"
      }
    >
      <div className="flex shrink-0 justify-end px-2 pt-2">
        <button
          type="button"
          className="tt-icon-button"
          aria-label={t(collapsed ? "inspector.expand" : "inspector.collapse")}
          aria-expanded={!collapsed}
          onClick={() => shellStore.getState().toggleInspector()}
        >
          <Icon name="collapse" className={collapsed ? "rotate-180" : ""} />
        </button>
      </div>
      <div hidden={collapsed} className="min-h-0 flex-1 overflow-y-auto px-5 pb-8">
        {children}
      </div>
    </aside>
  );
}

export function ShellLayout({ children }: { children: ReactNode }) {
  const phone = usePhone();
  const stop = useShell((s) => s.sheetStop);
  const hydrated = useShell((s) => s.hydrated);
  useGlobalKeys(phone);
  const canvasInert = phone && stop === "full";
  return (
    <div
      className="tt-shell flex h-dvh flex-col overflow-hidden bg-canvas"
      data-phone={phone ? "true" : "false"}
      data-hydrated={hydrated ? "true" : undefined}
    >
      <SkipLinks />
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <main
          className="flex min-w-0 flex-1 flex-col"
          inert={canvasInert}
          style={phone ? { paddingBottom: 112 } : undefined}
        >
          <Breadcrumbs />
          <CanvasHost />
          <TimeStrip />
          <FooterStrip />
        </main>
        {phone ? <Sheet>{children}</Sheet> : <SidePanel>{children}</SidePanel>}
      </div>
      <CommandPalette />
      <HelpDialog />
      <LiveRegion />
    </div>
  );
}
