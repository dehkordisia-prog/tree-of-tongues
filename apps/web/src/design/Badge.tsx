// Styling-only primitives for the nerd contract: every sound has a badge, every fact a confidence.
// Each one carries three channels: a text label, an icon and a border style. Color is the fourth.

export type SoundKind = "recording" | "reconstruction" | "synthetic";
export type Confidence = "high" | "medium" | "low" | "contested";

const soundLabel: Record<SoundKind, string> = {
  recording: "Recording",
  reconstruction: "Reconstruction",
  synthetic: "Synthetic",
};

/** What the badge promises, for title and screen-reader text. */
const soundMeaning: Record<SoundKind, string> = {
  recording: "a real speaker",
  reconstruction: "a scholarly reconstruction",
  synthetic: "machine-generated speech",
};

const soundClass: Record<SoundKind, string> = {
  recording: "text-badge-recording border-[1.5px] border-solid",
  reconstruction: "text-badge-reconstruction border-[1.5px] border-dashed",
  synthetic: "text-badge-synthetic border-2 border-dotted",
};

function SoundIcon({ kind }: { kind: SoundKind }) {
  const common = {
    "aria-hidden": true as const,
    focusable: "false" as const,
    width: 14,
    height: 14,
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
  };
  if (kind === "recording") {
    // Microphone
    return (
      <svg {...common}>
        <rect x="5.5" y="1.5" width="5" height="8" rx="2.5" />
        <path d="M3 7.5a5 5 0 0 0 10 0M8 12.5v2" />
      </svg>
    );
  }
  if (kind === "reconstruction") {
    // Asterisk: the linguist's mark for an unattested, reconstructed form.
    return (
      <svg {...common}>
        <path d="M8 2v12M2.8 5l10.4 6M2.8 11l10.4-6" />
      </svg>
    );
  }
  // Synthetic: a waveform drawn with straight segments
  return (
    <svg {...common}>
      <path d="M1.5 8h2l1.5-4 2 8 2-10 2 9 1.5-3h2" strokeLinejoin="round" />
    </svg>
  );
}

const chipBase =
  "inline-flex items-center gap-1.5 rounded-pill px-2.5 py-0.5 text-small font-medium leading-snug";

/** Recording, Reconstruction or Synthetic. Use `detail` for the variety, evidence or engine name. */
export function SoundBadge({ kind, detail }: { kind: SoundKind; detail?: string }) {
  return (
    <span className={`${chipBase} ${soundClass[kind]}`} title={`${soundLabel[kind]}: ${soundMeaning[kind]}`}>
      <SoundIcon kind={kind} />
      <span>{soundLabel[kind]}</span>
      <span className="sr-only">, {soundMeaning[kind]}</span>
      {detail && <span className="text-ink-muted font-normal">({detail})</span>}
    </span>
  );
}

const confLabel: Record<Confidence, string> = { high: "High", medium: "Medium", low: "Low", contested: "Contested" };
const confClass: Record<Confidence, string> = {
  high: "text-conf-high border-[1.5px] border-solid",
  medium: "text-conf-medium border-[1.5px] border-solid",
  low: "text-conf-low border-[1.5px] border-dashed",
  contested: "text-conf-contested border-double border-[3px]",
};

/** A three-bar meter; Contested shows two opposed bars instead. */
function ConfidenceIcon({ level }: { level: Confidence }) {
  if (level === "contested") {
    return (
      <svg aria-hidden="true" focusable="false" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
        <path d="M2 3h6v2H2zM8 11h6v2H8z" />
        <path d="M10 3l4 1-4 1zM6 11l-4 1 4 1z" />
      </svg>
    );
  }
  const filled = level === "high" ? 3 : level === "medium" ? 2 : 1;
  return (
    <svg aria-hidden="true" focusable="false" width="14" height="14" viewBox="0 0 16 16">
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={2 + i * 4.5}
          y={10 - i * 3.5}
          width="3"
          height={4 + i * 3.5}
          rx="0.5"
          fill={i < filled ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.2"
        />
      ))}
    </svg>
  );
}

/** Data confidence: High, Medium, Low or Contested (docs/CONTENT_STYLE.md, Badges). */
export function ConfidenceChip({ level }: { level: Confidence }) {
  return (
    <span className={`${chipBase} ${confClass[level]}`}>
      <ConfidenceIcon level={level} />
      <span className="sr-only">Confidence: </span>
      <span>{confLabel[level]}</span>
    </span>
  );
}
