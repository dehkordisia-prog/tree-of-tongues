// deck.gl 9 renderer for the tree: OrthographicView, one ScatterplotLayer (binary attributes taken
// straight from the Scene) and one TextLayer (SDF atlas). deck's own controller is off; the shared
// input code drives the same Camera as the PixiJS renderer and this file only maps it to a
// viewState. deck draws on its own animation frame, so render() sets props and returns.

import { Deck, OrthographicView } from "@deck.gl/core";
import { ScatterplotLayer, TextLayer } from "@deck.gl/layers";

import type { Camera } from "./camera";
import { LABEL_KIND_BELOW, LABEL_KIND_TOP, LOD, type Palette, type Scene } from "./lod";
import type { RendererInit, TreeRenderer } from "./renderer";

interface LabelDatum {
  text: string;
  position: [number, number];
  top: boolean;
  below: boolean;
  alpha: number;
}

export class DeckRenderer implements TreeRenderer {
  readonly name = "deck" as const;
  readonly firstFrame: Promise<void>;
  private resolveFirst!: () => void;
  private deck: Deck<OrthographicView> | null = null;
  private opts!: RendererInit;
  private palette!: Palette;
  private lastVersion = -1;
  private layers: (ScatterplotLayer | TextLayer<LabelDatum>)[] = [];
  private positions = new Float32Array(0);
  private shown = 0;
  private charset: string[] = [];
  private armed = false;

  constructor() {
    this.firstFrame = new Promise((res) => (this.resolveFirst = res));
  }

  async init(opts: RendererInit): Promise<void> {
    this.opts = opts;
    this.palette = opts.palette;
    const chars = new Set<string>([" "]);
    for (const nm of opts.layout.name) for (const ch of nm) chars.add(ch);
    this.charset = Array.from(chars);
    this.deck = new Deck<OrthographicView>({
      canvas: opts.canvas,
      views: new OrthographicView({ id: "tree" }),
      viewState: { target: [0, 0, 0], zoom: 0 },
      controller: false,
      layers: [],
      useDevicePixels: true,
      getCursor: () => "inherit",
      onAfterRender: () => {
        if (this.armed) {
          this.armed = false;
          this.resolveFirst();
        }
      },
    });
  }

  resize(): void {
    // deck watches the canvas size itself.
  }

  setPalette(palette: Palette): void {
    this.palette = palette;
    this.lastVersion = -1;
  }

  render(scene: Scene, cam: Camera): void {
    const deck = this.deck;
    if (!deck) return;
    const viewState = { target: [cam.cx, cam.cy, 0] as [number, number, number], zoom: Math.log2(cam.scale) };
    if (scene.version === this.lastVersion) {
      deck.setProps({ viewState });
      return;
    }
    this.lastVersion = scene.version;
    const n = scene.count; // nodes and glyph parts (dashed and dotted rings draw solid in deck)
    if (this.positions.length < scene.cap * 2) this.positions = new Float32Array(scene.cap * 2);
    const pos = this.positions;
    for (let i = 0; i < n; i++) {
      pos[i * 2] = scene.x[i]!;
      pos[i * 2 + 1] = scene.y[i]!;
    }
    const circles = new ScatterplotLayer({
      id: "circles",
      data: {
        length: n,
        attributes: {
          getPosition: { value: pos, size: 2 },
          getRadius: { value: scene.r, size: 1 },
          getFillColor: { value: scene.fill, size: 4, normalized: true },
          getLineColor: { value: scene.line, size: 4, normalized: true },
          getLineWidth: { value: scene.lineW, size: 1 },
        },
      },
      radiusUnits: "common",
      lineWidthUnits: "pixels",
      filled: true,
      stroked: true,
      antialiasing: true,
      parameters: { depthCompare: "always", depthWriteEnabled: false },
    });

    const { layout } = this.opts;
    const labels: LabelDatum[] = [];
    for (let k = 0; k < scene.labelCount; k++) {
      const v = scene.labelId[k]!;
      const top = scene.labelKind[k] === LABEL_KIND_TOP;
      const below = scene.labelKind[k] === LABEL_KIND_BELOW;
      labels.push({
        text: layout.name[v]!,
        position: [layout.x[v]!, layout.y[v]! + (top ? -layout.r[v]! : below ? layout.r[v]! : 0)],
        top,
        below,
        alpha: scene.labelAlpha[k]!,
      });
    }
    this.shown = labels.length;
    const ink = this.palette.ink;
    const halo = this.palette.canvas;
    const text = new TextLayer<LabelDatum>({
      id: "labels",
      data: labels,
      getText: (d) => d.text,
      getPosition: (d) => d.position,
      getColor: (d) => [ink[0], ink[1], ink[2], Math.round(d.alpha * 255)],
      getSize: LOD.LABEL_FONT_PX,
      sizeUnits: "pixels",
      getTextAnchor: "middle",
      getAlignmentBaseline: "center",
      getPixelOffset: (d) => [0, d.top ? LOD.LABEL_FONT_PX : d.below ? LOD.LABEL_FONT_PX * 0.8 : 0],
      fontFamily: this.opts.fontFamily,
      fontWeight: 600,
      characterSet: this.charset,
      fontSettings: { sdf: true, fontSize: 64, buffer: 8, radius: 12, cutoff: 0.3 },
      outlineWidth: 6,
      outlineColor: [halo[0], halo[1], halo[2], 255],
      parameters: { depthCompare: "always", depthWriteEnabled: false },
    });
    this.layers = [circles, text];
    this.armed = true;
    deck.setProps({ viewState, layers: this.layers });
  }

  labelsDrawn(): number {
    return this.shown;
  }

  destroy(): void {
    this.deck?.finalize();
    this.deck = null;
  }
}
