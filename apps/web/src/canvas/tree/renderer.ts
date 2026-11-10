// What a tree renderer must do. Both implementations draw the same Scene with the same Camera.

import type { Camera, Size } from "./camera";
import type { TreeLayout } from "./layout";
import type { Palette, Scene } from "./lod";

export type RendererName = "pixi" | "deck";

export interface RendererInit {
  canvas: HTMLCanvasElement;
  layout: TreeLayout;
  size: Size;
  dpr: number;
  palette: Palette;
  /** CSS font-family for labels. The font must already be loaded. */
  fontFamily: string;
}

export interface TreeRenderer {
  readonly name: RendererName;
  init(opts: RendererInit): Promise<void>;
  resize(size: Size, dpr: number): void;
  /** Theme change: recolor labels. Circle colors come from the Scene. */
  setPalette(palette: Palette): void;
  /** Draw (or schedule drawing of) the scene. Cheap when only the camera changed. */
  render(scene: Scene, cam: Camera, size: Size): void;
  /** Resolves after the first frame has been drawn. */
  readonly firstFrame: Promise<void>;
  /** Labels the renderer actually put on screen in the last frame. */
  labelsDrawn(): number;
  destroy(): void;
}

export const rgbHex = (c: readonly [number, number, number]): number => (c[0] << 16) | (c[1] << 8) | c[2];
