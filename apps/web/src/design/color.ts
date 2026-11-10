// Color math for the design system. No dependencies.
// Used by tests (contrast and color-blind checks), by the /design specimen and by canvases.

export type Rgb = readonly [number, number, number];

export function hexToRgb(hex: string): Rgb {
  const h = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error(`Expected #rrggbb, got ${hex}`);
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function rgbToHex([r, g, b]: Rgb): string {
  const c = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}

/** 0xRRGGBB, the form PixiJS expects. */
export function hexToNumber(hex: string): number {
  return parseInt(hex.replace("#", ""), 16);
}

const toLinear = (c8: number) => {
  const c = c8 / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const toGamma = (c: number) => {
  const v = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
  return Math.min(255, Math.max(0, v * 255));
};

/** WCAG 2.x relative luminance. */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(toLinear) as unknown as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x contrast ratio, 1 to 21. */
export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Truncate (never round up) to two decimals, so a reported 4.50 is really at least 4.5. */
export function ratioLabel(r: number): string {
  return (Math.floor(r * 100) / 100).toFixed(2);
}

export type Cvd = "protanopia" | "deuteranopia" | "tritanopia";

// Machado, Oliveira and Fernandes (2009), severity 1.0, applied in linear RGB.
export const CVD_MATRICES: Record<Cvd, readonly number[]> = {
  protanopia: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998],
  deuteranopia: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881],
  tritanopia: [1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.3039],
};

export function simulateCvd(hex: string, kind: Cvd): string {
  const [r, g, b] = hexToRgb(hex).map(toLinear) as unknown as Rgb;
  const m = CVD_MATRICES[kind];
  const row = (i: number) => m[i * 3]! * r + m[i * 3 + 1]! * g + m[i * 3 + 2]! * b;
  return rgbToHex([toGamma(row(0)), toGamma(row(1)), toGamma(row(2))]);
}

/** OKLab (Ottosson 2020). L is 0 to 1. */
export function toOklab(hex: string): Rgb {
  const [r, g, b] = hexToRgb(hex).map(toLinear) as unknown as Rgb;
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** Euclidean distance in OKLab. About 0.02 is a just-noticeable difference for large patches. */
export function deltaOk(a: string, b: string): number {
  const [l1, a1, b1] = toOklab(a);
  const [l2, a2, b2] = toOklab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}
