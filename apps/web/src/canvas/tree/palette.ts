import { hexToRgb } from "@/design/color";
import { familyColor, ui, type ThemeName } from "@/design/tokens";

import { FAMILY_ORDER } from "./family";
import type { Palette, Rgb } from "./lod";

/** Canvas colors from design tokens: family marks for nodes, ink for labels, canvas for halos. */
export function makePalette(theme: ThemeName): Palette {
  const rgb = (hex: string): Rgb => {
    const [r, g, b] = hexToRgb(hex);
    return [r, g, b];
  };
  return {
    mark: FAMILY_ORDER.map((id) => {
      const [r, g, b] = familyColor(id, theme, "mark").rgba;
      return [r, g, b] as Rgb;
    }),
    ink: rgb(ui[theme].ink),
    canvas: rgb(ui[theme].canvas),
    lineStrong: rgb(ui[theme].lineStrong),
  };
}
