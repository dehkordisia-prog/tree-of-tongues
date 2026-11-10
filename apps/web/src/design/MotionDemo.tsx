import { AnimatePresence, motion } from "motion/react";
import { useId, useRef, useState } from "react";

import { duration, easing, flightDuration, motionFor, spring, stagger } from "./tokens";
import { usePrefersReducedMotion } from "./useReducedMotion";

const bezier = (e: readonly number[]) => `cubic-bezier(${e.join(", ")})`;

/* Camera flight: family, branch, language. Labels are generic on purpose (no data on this page). */
const stops = [
  { name: "Family", x: 80, y: 112, scale: 1, level: 0 },
  { name: "Branch", x: 230, y: 78, scale: 2.2, level: 1 },
  { name: "Language", x: 318, y: 150, scale: 4.5, level: 3 },
] as const;
const VIEW_W = 400;
const VIEW_H = 225;
const cameraTransform = (i: number) => {
  const s = stops[i]!;
  const k = s.scale;
  const tx = i === 0 ? 0 : VIEW_W / 2 - s.x * k;
  const ty = i === 0 ? 0 : VIEW_H / 2 - s.y * k;
  return `translate(${tx}px, ${ty}px) scale(${k})`;
};

const starField = Array.from({ length: 40 }, (_, i) => ({
  x: (i * 97) % VIEW_W,
  y: (i * 53 + (i % 3) * 17) % VIEW_H,
  r: i % 5 === 0 ? 1.1 : 0.6,
}));

function CameraFlight({ reduced }: { reduced: boolean }) {
  const [stop, setStop] = useState(0);
  const world = useRef<SVGGElement>(null);
  const anim = useRef<Animation | null>(null);

  async function fly() {
    const next = (stop + 1) % stops.length;
    const el = world.current;
    setStop(next);
    if (!el || typeof el.animate !== "function") return;
    const from = getComputedStyle(el).transform;
    anim.current?.cancel();
    const to = cameraTransform(next);
    el.style.transform = to;
    const plan = motionFor("flight", reduced);
    if (plan.mode === "crossfade") {
      // The camera jumps; the frame fades through, so context survives without travel.
      el.style.transform = from === "none" ? "" : from;
      const out = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: plan.duration / 2, fill: "forwards" });
      anim.current = out;
      try {
        await out.finished;
      } catch {
        return; // interrupted by another click
      }
      el.style.transform = to;
      out.cancel();
      anim.current = el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: plan.duration / 2 });
      return;
    }
    const levels = Math.abs(stops[next]!.level - stops[stop]!.level);
    anim.current = el.animate([{ transform: from === "none" ? cameraTransform(0) : from }, { transform: to }], {
      duration: flightDuration(levels),
      easing: bezier(plan.ease),
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-lg border border-line bg-canvas">
        <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="block h-auto w-full" role="img" aria-label="Camera demo">
          <g ref={world} style={{ transformOrigin: "0 0" }}>
            {starField.map((s, i) => (
              <circle key={i} cx={s.x} cy={s.y} r={s.r} className="fill-ink-muted" opacity={0.5} />
            ))}
            <path d="M80 112 L230 78 L300 60 M230 78 L318 150 M230 78 L270 120" className="stroke-line-strong" strokeWidth={1} fill="none" />
            <circle cx={80} cy={112} r={26} className="fill-fam-turkic" opacity={0.9} />
            <text x={80} y={155} textAnchor="middle" className="fill-ink" fontSize={12}>
              Family
            </text>
            <circle cx={230} cy={78} r={9} className="fill-fam-turkic" />
            <text x={230} y={64} textAnchor="middle" className="fill-ink" fontSize={6}>
              Branch
            </text>
            <circle cx={300} cy={60} r={4} className="fill-fam-turkic" opacity={0.7} />
            <circle cx={270} cy={120} r={4} className="fill-fam-turkic" opacity={0.7} />
            <circle cx={318} cy={150} r={3.5} className="fill-fam-turkic" />
            <text x={318} y={158} textAnchor="middle" className="fill-ink" fontSize={2.6}>
              Language
            </text>
          </g>
        </svg>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="tt-button" onClick={fly}>
          Fly to {stops[(stop + 1) % stops.length]!.name.toLowerCase()}
        </button>
        <p className="text-small text-ink-muted" aria-live="polite">
          Camera at {stops[stop]!.name.toLowerCase()}.{" "}
          {reduced ? "Crossfade, 200 ms." : `Flight, ${duration.flightShort} to ${duration.flightLong} ms by distance.`}
        </p>
      </div>
    </div>
  );
}

const petals = Array.from({ length: 6 }, (_, i) => {
  const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
  return { x: Math.cos(a) * 64, y: Math.sin(a) * 64 };
});

function Bloom({ reduced }: { reduced: boolean }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="flex flex-col gap-3">
      <div className="relative grid h-56 place-items-center overflow-hidden rounded-lg border border-line bg-canvas" id={id}>
        <AnimatePresence>
          {open &&
            petals.map((p, i) => (
              <motion.span
                key={i}
                aria-hidden="true"
                className="absolute size-6 rounded-pill bg-fam-japonic"
                initial={reduced ? { opacity: 0, x: p.x, y: p.y } : { opacity: 0, x: 0, y: 0, scale: 0.4 }}
                animate={{ opacity: 1, x: p.x, y: p.y, scale: 1 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, x: 0, y: 0, scale: 0.4 }}
                transition={
                  reduced
                    ? { duration: duration.crossfade / 1000, ease: easing.standard }
                    : { ...spring.bloom, delay: (Math.min(i, stagger.maxSteps) * stagger.step) / 1000 }
                }
              />
            ))}
        </AnimatePresence>
        <span aria-hidden="true" className="relative size-10 rounded-pill bg-fam-japonic shadow-raised" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="tt-button" aria-controls={id} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {open ? "Fold children" : "Bloom children"}
        </button>
        <p className="text-small text-ink-muted" aria-live="polite">
          {open ? "Six children shown." : "Children hidden."}{" "}
          {reduced ? "Crossfade." : `Spring: stiffness ${spring.bloom.stiffness}, damping ${spring.bloom.damping}.`}
        </p>
      </div>
    </div>
  );
}

function UiTransition() {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="flex flex-col gap-3">
      <div className="relative h-56 overflow-hidden rounded-lg border border-line bg-canvas p-3">
        <p className="text-small text-ink-muted">Canvas stays put. The panel arrives from below.</p>
        <div
          id={id}
          inert={!open}
          className={`absolute inset-x-3 bottom-3 rounded-lg border border-line bg-raised p-4 shadow-overlay transition-[opacity,translate,visibility] duration-(--tt-dur-ui) ease-standard ${
            open ? "visible translate-y-0 opacity-100" : "invisible translate-y-[calc(1rem*var(--tt-motion-distance))] opacity-0"
          }`}
        >
          <p className="font-display text-title-sm">Inspector</p>
          <p className="text-small text-ink-muted">A bottom sheet on phones, a side panel on desktop.</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="tt-button" aria-controls={id} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {open ? "Close panel" : "Open panel"}
        </button>
        <p className="text-small text-ink-muted">{duration.ui} ms, standard easing. Opacity only under reduced motion.</p>
      </div>
    </div>
  );
}

export function MotionDemo() {
  const systemReduced = usePrefersReducedMotion();
  const [preview, setPreview] = useState(false);
  const reduced = systemReduced || preview;
  const checkId = useId();

  return (
    <div data-motion={reduced ? "reduce" : undefined} className="flex flex-col gap-6">
      <div className="flex min-h-target items-center gap-3">
        <input
          id={checkId}
          type="checkbox"
          className="size-5 accent-(--tt-accent)"
          checked={reduced}
          disabled={systemReduced}
          onChange={(e) => setPreview(e.target.checked)}
        />
        <label htmlFor={checkId} className="text-body">
          Preview reduced motion
          {systemReduced && <span className="text-ink-muted"> (on: your system asks for it)</span>}
        </label>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <section aria-labelledby={`${checkId}-ui`} className="flex flex-col gap-2">
          <h3 id={`${checkId}-ui`} className="text-title-sm">
            UI transition
          </h3>
          <UiTransition />
        </section>
        <section aria-labelledby={`${checkId}-flight`} className="flex flex-col gap-2">
          <h3 id={`${checkId}-flight`} className="text-title-sm">
            Camera flight
          </h3>
          <CameraFlight reduced={reduced} />
        </section>
        <section aria-labelledby={`${checkId}-bloom`} className="flex flex-col gap-2">
          <h3 id={`${checkId}-bloom`} className="text-title-sm">
            Bloom
          </h3>
          <Bloom reduced={reduced} />
        </section>
      </div>
    </div>
  );
}
