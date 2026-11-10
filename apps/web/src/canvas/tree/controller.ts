// Framework-free controller shared by both renderers: camera, flights, focus, input, keyboard,
// the frame loop and the benchmark run. React only mounts it and shows breadcrumb, list and
// live-region text.

import {
  type Camera,
  clampCenter,
  fitCircle,
  Flight,
  panBy,
  type Size,
  toScreen,
  toWorld,
  zoomAt,
} from "./camera";
import { BENCH_MS, benchCamera, type BenchResult, frameStats, pickBenchTarget } from "./bench";
import { describeNode } from "./describe";
import { WORLD_RADIUS, type TreeLayout } from "./layout";
import { type Palette, Scene } from "./lod";
import type { TreeRenderer } from "./renderer";

export interface UiState {
  focus: number;
  cursor: number;
  /** Root first, focus last. */
  path: number[];
  /** Children of the focus, largest first (capped). */
  kids: number[];
  kidsTotal: number;
}

export interface FrameStats {
  circles: number;
  labels: number;
  visited: number;
  /** Moving averages of main-thread time per frame, ms. */
  buildMs: number;
  submitMs: number;
}

export const KIDS_LIST_MAX = 40;

export interface ControllerOptions {
  canvas: HTMLCanvasElement;
  /** Absolutely positioned ring that marks the keyboard cursor. */
  cursorRing: HTMLElement;
  layout: TreeLayout;
  renderer: TreeRenderer;
  palette: Palette;
  size: Size;
  reducedMotion: () => boolean;
  onState: (s: UiState) => void;
  onAnnounce: (message: string) => void;
  initialFocus?: number;
}

export class TreeController {
  readonly layout: TreeLayout;
  readonly scene: Scene;
  cam: Camera;
  focus: number;
  cursor = -1;
  size: Size;
  stats: FrameStats = { circles: 0, labels: 0, visited: 0, buildMs: 0, submitMs: 0 };

  private readonly o: ControllerOptions;
  private palette: Palette;
  private epoch = 1;
  private flight: Flight | null = null;
  private flightStart = 0;
  private raf = 0;
  private dirty = true;
  private destroyed = false;
  private keyboard = false;
  private pointers = new Map<number, { x: number; y: number }>();
  private dragged = false;
  private downAt = { x: 0, y: 0 };
  private pinch: { dist: number; mx: number; my: number } | null = null;
  private benchState: {
    start: number;
    stamps: number[];
    labelsMax: number;
    target: number;
    done: (r: BenchResult) => void;
  } | null = null;

  constructor(opts: ControllerOptions) {
    this.o = opts;
    this.layout = opts.layout;
    this.size = opts.size;
    this.palette = opts.palette;
    this.scene = new Scene(opts.layout);
    this.focus = opts.initialFocus ?? opts.layout.root;
    this.cam = this.targetCamera(this.focus);
    const c = opts.canvas;
    c.addEventListener("pointerdown", this.onPointerDown);
    c.addEventListener("pointermove", this.onPointerMove);
    c.addEventListener("pointerup", this.onPointerUp);
    c.addEventListener("pointercancel", this.onPointerUp);
    c.addEventListener("wheel", this.onWheel, { passive: false });
    c.addEventListener("keydown", this.onKeyDown);
    c.addEventListener("blur", this.onBlur);
    this.resetCursor();
    this.emit();
    this.wake();
  }

  destroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    const c = this.o.canvas;
    c.removeEventListener("pointerdown", this.onPointerDown);
    c.removeEventListener("pointermove", this.onPointerMove);
    c.removeEventListener("pointerup", this.onPointerUp);
    c.removeEventListener("pointercancel", this.onPointerUp);
    c.removeEventListener("wheel", this.onWheel);
    c.removeEventListener("keydown", this.onKeyDown);
    c.removeEventListener("blur", this.onBlur);
  }

  /* ------------------------------------------------------------ state */

  private targetCamera(v: number): Camera {
    const L = this.layout;
    if (v === L.root) return fitCircle(0, 0, WORLD_RADIUS, this.size);
    return fitCircle(L.x[v]!, L.y[v]!, L.r[v]!, this.size);
  }

  pathOf(v: number): number[] {
    const out: number[] = [];
    for (let k = v; k >= 0; k = this.layout.parent[k]!) out.push(k);
    return out.reverse();
  }

  private emit(): void {
    const L = this.layout;
    const a = L.childStart[this.focus]!;
    const b = L.childStart[this.focus + 1]!;
    const kids: number[] = [];
    for (let k = a; k < Math.min(b, a + KIDS_LIST_MAX); k++) kids.push(L.childList[k]!);
    this.o.onState({ focus: this.focus, cursor: this.cursor, path: this.pathOf(this.focus), kids, kidsTotal: b - a });
  }

  private resetCursor(): void {
    const L = this.layout;
    this.cursor = L.childStart[this.focus]! < L.childStart[this.focus + 1]! ? L.childList[L.childStart[this.focus]!]! : -1;
  }

  wake(): void {
    if (this.raf || this.destroyed) return;
    this.raf = requestAnimationFrame(this.frame);
  }

  setPalette(p: Palette): void {
    this.palette = p;
    this.epoch++;
    this.dirty = true;
    this.o.renderer.setPalette(p);
    this.wake();
  }

  resize(size: Size): void {
    this.size = size;
    this.dirty = true;
    this.wake();
  }

  /* ----------------------------------------------------------- focus */

  focusNode(v: number, announce = true): void {
    if (v < 0 || v > this.layout.root) return;
    const levels = Math.abs(this.layout.depth[v]! - this.layout.depth[this.focus]!) + 1;
    this.focus = v;
    this.epoch++;
    this.resetCursor();
    this.flyTo(this.targetCamera(v), levels);
    this.emit();
    if (announce) {
      const kids = this.layout.childStart[v + 1]! - this.layout.childStart[v]!;
      this.o.onAnnounce(`Focused ${describeNode(this.layout, v)}.${kids > 0 ? ` ${kids.toLocaleString("en")} inside.` : " Nothing deeper in this tree."}`);
    }
  }

  focusParent(): void {
    const L = this.layout;
    if (this.focus === L.root) {
      this.o.onAnnounce("Already showing the whole tree.");
      return;
    }
    const from = this.focus;
    this.focusNode(L.parent[from]!, false);
    this.cursor = from;
    this.emit();
    this.o.onAnnounce(`Zoomed out to ${describeNode(L, this.focus)}.`);
  }

  private flyTo(to: Camera, levels: number): void {
    if (this.o.reducedMotion()) {
      this.flight = null;
      this.cam = to;
      this.crossfade();
    } else {
      this.flight = new Flight(this.cam, to, this.size, levels);
      this.flightStart = performance.now();
    }
    this.dirty = true;
    this.wake();
  }

  /** Reduced motion: the camera jumps and the canvas fades back in over 200 ms. */
  private crossfade(): void {
    this.o.canvas.animate?.([{ opacity: 0.35 }, { opacity: 1 }], { duration: 200, easing: "ease-out" });
  }

  moveCursor(delta: number): void {
    const L = this.layout;
    const a = L.childStart[this.focus]!;
    const b = L.childStart[this.focus + 1]!;
    const n = b - a;
    if (n === 0) {
      this.o.onAnnounce(`${describeNode(L, this.focus)}. Nothing deeper in this tree.`);
      return;
    }
    let idx = this.cursor >= 0 ? (L.childList.indexOf(this.cursor, a) - a) : -1;
    if (idx < 0 || idx >= n) idx = delta > 0 ? -1 : 0;
    idx = (idx + delta + n) % n;
    this.cursor = L.childList[a + idx]!;
    this.keepCursorVisible();
    this.emit();
    this.dirty = true;
    this.wake();
    this.o.onAnnounce(`${describeNode(L, this.cursor)}. ${idx + 1} of ${n.toLocaleString("en")}.`);
  }

  private keepCursorVisible(): void {
    const v = this.cursor;
    if (v < 0) return;
    const [sx, sy] = toScreen(this.cam, this.size, this.layout.x[v]!, this.layout.y[v]!);
    const m = 24;
    const inside = sx > m && sx < this.size.w - m && sy > m && sy < this.size.h - m;
    if (!inside) this.flyTo({ ...this.cam, cx: this.layout.x[v]!, cy: this.layout.y[v]! }, 1);
  }

  /* ----------------------------------------------------------- input */

  private cancelFlight(): void {
    this.flight = null;
  }

  private onBlur = () => {
    this.keyboard = false;
    this.dirty = true;
    this.wake();
  };

  private local(e: { clientX: number; clientY: number }): { x: number; y: number } {
    const r = this.o.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private onWheel = (e: WheelEvent) => {
    if (this.benchState) return;
    e.preventDefault();
    const p = this.local(e);
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? this.size.h : 1;
    const k = e.ctrlKey ? 0.01 : 0.0016;
    this.cancelFlight();
    this.cam = clampCenter(zoomAt(this.cam, this.size, p.x, p.y, Math.exp(-e.deltaY * unit * k)));
    this.dirty = true;
    this.wake();
  };

  private onPointerDown = (e: PointerEvent) => {
    if (this.benchState) return;
    this.keyboard = false;
    this.o.canvas.focus({ preventScroll: true });
    this.o.canvas.setPointerCapture(e.pointerId);
    const p = this.local(e);
    this.pointers.set(e.pointerId, p);
    if (this.pointers.size === 1) {
      this.dragged = false;
      this.downAt = p;
    }
    if (this.pointers.size === 2) {
      this.pinch = this.pinchState();
      this.dragged = true;
    }
    this.cancelFlight();
    this.dirty = true;
    this.wake();
  };

  private pinchState() {
    const [a, b] = [...this.pointers.values()] as [{ x: number; y: number }, { x: number; y: number }];
    return { dist: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
  }

  private onPointerMove = (e: PointerEvent) => {
    const prev = this.pointers.get(e.pointerId);
    if (!prev || this.benchState) return;
    const p = this.local(e);
    this.pointers.set(e.pointerId, p);
    if (this.pointers.size === 2 && this.pinch) {
      const now = this.pinchState();
      let cam = panBy(this.cam, now.mx - this.pinch.mx, now.my - this.pinch.my);
      if (this.pinch.dist > 0) cam = zoomAt(cam, this.size, now.mx, now.my, now.dist / this.pinch.dist);
      this.cam = clampCenter(cam);
      this.pinch = now;
    } else if (this.pointers.size === 1) {
      if (!this.dragged && Math.hypot(p.x - this.downAt.x, p.y - this.downAt.y) > 4) this.dragged = true;
      if (this.dragged) this.cam = clampCenter(panBy(this.cam, p.x - prev.x, p.y - prev.y));
    }
    this.dirty = true;
    this.wake();
  };

  private onPointerUp = (e: PointerEvent) => {
    if (!this.pointers.has(e.pointerId)) return;
    const p = this.local(e);
    const wasSingle = this.pointers.size === 1;
    this.pointers.delete(e.pointerId);
    this.pinch = null;
    if (wasSingle && !this.dragged && e.type === "pointerup") {
      const [wx, wy] = toWorld(this.cam, this.size, p.x, p.y);
      const hit = this.scene.pick(wx, wy);
      if (hit >= 0) this.focusNode(hit);
    }
    if (this.pointers.size === 1) {
      // Pinch ended with one finger left: continue as a drag from here.
      this.dragged = true;
    }
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (this.benchState || e.altKey || e.ctrlKey || e.metaKey) return;
    let handled = true;
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
      case "ArrowLeft":
      case "ArrowUp": {
        // The first arrow press only reveals the cursor; later presses move it.
        const reveal = !this.keyboard;
        this.keyboard = true;
        const forward = e.key === "ArrowRight" || e.key === "ArrowDown";
        this.moveCursor(reveal ? 0 : forward ? 1 : -1);
        break;
      }
      case "Enter":
        this.keyboard = true;
        if (this.cursor >= 0) this.focusNode(this.cursor);
        else this.o.onAnnounce(`${describeNode(this.layout, this.focus)}. Nothing deeper in this tree.`);
        break;
      case "Escape":
      case "Backspace":
        this.keyboard = true;
        this.focusParent();
        break;
      case "Home":
        this.keyboard = true;
        this.focusNode(this.layout.root);
        break;
      case "+":
      case "=":
        this.zoomCenter(1.6);
        break;
      case "-":
      case "_":
        this.zoomCenter(1 / 1.6);
        break;
      default:
        handled = false;
    }
    if (handled) e.preventDefault();
  };

  private zoomCenter(factor: number): void {
    this.cancelFlight();
    const target = clampCenter(zoomAt(this.cam, this.size, this.size.w / 2, this.size.h / 2, factor));
    if (this.o.reducedMotion()) {
      this.cam = target;
      this.dirty = true;
      this.wake();
    } else {
      this.flyTo(target, 1);
    }
  }

  /* ----------------------------------------------------------- frames */

  private frame = (ts: number) => {
    this.raf = 0;
    if (this.destroyed) return;
    let force = false;
    let keepGoing = false;

    const b = this.benchState;
    if (b) {
      if (b.stamps.length === 0) b.start = ts;
      b.stamps.push(ts);
      const t = ts - b.start;
      this.cam = benchCamera(Math.min(t, BENCH_MS), this.layout, this.size, b.target);
      force = true;
      keepGoing = true;
      if (t >= BENCH_MS) {
        this.finishBench();
        keepGoing = false;
      }
    } else if (this.flight) {
      const t = performance.now() - this.flightStart;
      this.cam = this.flight.at(t);
      if (this.flight.done(t)) {
        this.cam = this.flight.to;
        this.flight = null;
      } else keepGoing = true;
      this.dirty = true;
    }

    if (this.dirty || force) {
      this.dirty = false;
      const t0 = performance.now();
      this.scene.build(this.cam, this.size, this.focus, this.palette, this.epoch);
      const t1 = performance.now();
      this.o.renderer.render(this.scene, this.cam, this.size);
      const t2 = performance.now();
      const k = 0.1;
      this.stats = {
        circles: this.scene.count,
        labels: this.o.renderer.labelsDrawn(),
        visited: this.scene.visited,
        buildMs: this.stats.buildMs ? this.stats.buildMs * (1 - k) + (t1 - t0) * k : t1 - t0,
        submitMs: this.stats.submitMs ? this.stats.submitMs * (1 - k) + (t2 - t1) * k : t2 - t1,
      };
      if (b) b.labelsMax = Math.max(b.labelsMax, this.stats.labels);
      this.placeCursorRing();
    }
    if (keepGoing) this.wake();
  };

  private placeCursorRing(): void {
    const ring = this.o.cursorRing;
    const v = this.cursor;
    if (!this.keyboard || v < 0 || this.benchState) {
      ring.style.display = "none";
      return;
    }
    const [sx, sy] = toScreen(this.cam, this.size, this.layout.x[v]!, this.layout.y[v]!);
    const d = Math.max(2 * this.layout.r[v]! * this.cam.scale + 8, 18);
    ring.style.display = "block";
    ring.style.width = `${d}px`;
    ring.style.height = `${d}px`;
    ring.style.transform = `translate(${sx - d / 2}px, ${sy - d / 2}px)`;
  }

  /* ------------------------------------------------------------ bench */

  /** Plays the fixed 20 s path. Resolves with frame statistics. */
  runBench(info: { renderer: BenchResult["renderer"]; layoutMs: number; firstFrameMs: number }): Promise<BenchResult> {
    this.flight = null;
    const target = pickBenchTarget(this.layout);
    return new Promise((resolve) => {
      this.benchState = {
        start: 0,
        stamps: [],
        labelsMax: 0,
        target,
        done: (r) => resolve({ ...r, renderer: info.renderer, layoutMs: info.layoutMs, firstFrameMs: info.firstFrameMs }),
      };
      this.wake();
    });
  }

  private finishBench(): void {
    const b = this.benchState!;
    this.benchState = null;
    const s = frameStats(b.stamps);
    b.done({
      renderer: "pixi",
      nodes: this.layout.n,
      ...s,
      firstFrameMs: 0,
      layoutMs: 0,
      labelsDrawnMax: b.labelsMax,
    });
    this.cam = this.targetCamera(this.focus);
    this.dirty = true;
    this.wake();
  }

}
