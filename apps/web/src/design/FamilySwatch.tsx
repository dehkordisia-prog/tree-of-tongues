import { useId } from "react";

import { patternGeometry, type PatternPrimitive } from "./patterns";
import { markerPath, PATTERN_STROKE, PATTERN_TILE, type MarkerKind, type PatternKind } from "./tokens";

function Primitive({ p, color }: { p: PatternPrimitive; color: string }) {
  switch (p.type) {
    case "line":
      return <line x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} stroke={color} strokeWidth={PATTERN_STROKE} />;
    case "polyline":
      return (
        <polyline
          points={p.points.map(([x, y]) => `${x},${y}`).join(" ")}
          fill="none"
          stroke={color}
          strokeWidth={PATTERN_STROKE}
        />
      );
    case "dot":
      return <circle cx={p.cx} cy={p.cy} r={p.r} fill={color} />;
    case "ring":
      return <circle cx={p.cx} cy={p.cy} r={p.r} fill="none" stroke={color} strokeWidth={1.2} />;
    case "rect":
      return <rect x={p.x} y={p.y} width={p.w} height={p.h} fill={color} />;
  }
}

interface SwatchProps {
  pattern: PatternKind;
  /** Any CSS color: a var(--tt-fam-*) for live theming, or a hex (for simulations). */
  color: string;
  size?: number;
  className?: string;
}

/** A patterned family swatch. Decorative: pair it with a visible family name. */
export function FamilySwatch({ pattern, color, size = 48, className }: SwatchProps) {
  const id = useId().replace(/:/g, "");
  const g = patternGeometry[pattern];
  const inset = g.borderWidth / 2;
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
    >
      <defs>
        <pattern id={`p${id}`} width={PATTERN_TILE} height={PATTERN_TILE} patternUnits="userSpaceOnUse">
          {g.fillAlpha > 0 && (
            <rect width={PATTERN_TILE} height={PATTERN_TILE} fill={color} fillOpacity={g.fillAlpha} />
          )}
          {g.primitives.map((p, i) => (
            <Primitive key={i} p={p} color={color} />
          ))}
        </pattern>
      </defs>
      <rect
        x={inset}
        y={inset}
        width={size - g.borderWidth}
        height={size - g.borderWidth}
        rx={4}
        fill={`url(#p${id})`}
        stroke={color}
        strokeWidth={g.borderWidth}
      />
    </svg>
  );
}

/** A family point marker (map dots, tree nodes at low zoom). Decorative. */
export function FamilyMarker({ marker, color, size = 20 }: { marker: MarkerKind; color: string; size?: number }) {
  return (
    <svg aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 24 24">
      <path d={markerPath[marker]} fill={color} fillRule="evenodd" />
    </svg>
  );
}
