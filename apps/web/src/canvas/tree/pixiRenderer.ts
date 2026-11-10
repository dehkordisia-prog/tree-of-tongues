// PixiJS 8 renderer for the tree.
//
// Circles: one instanced Mesh with a small SDF circle shader (fill plus a ring whose width is a
// constant number of screen pixels). One draw call, one instance per circle. A textured sprite or
// ParticleContainer was rejected: a 128 px circle texture blurs when a node fills the screen,
// and constant-pixel outlines need a texture per zoom band. Graphics was rejected: it re-tessellates.
// Text: BitmapText from an installed bitmap font rendered at devicePixelRatio. The font holds only
// the characters found in the data, glyphs are pixel-aligned (positions are rounded to device
// pixels), and a label update is a quad update, not a texture upload.

import { Application, BitmapFont, BitmapText, Buffer, BufferUsage, Container, Geometry, Mesh, Rectangle, Shader, UniformGroup } from "pixi.js";

import type { Camera, Size } from "./camera";
import { LOD, LABEL_KIND_TOP, type Palette, type Scene } from "./lod";
import { rgbHex, type RendererInit, type TreeRenderer } from "./renderer";

const VERTEX = `
in vec2 aPosition;
in vec3 aCircle;
in vec4 aFill;
in vec4 aLine;
in float aLineW;
uniform vec2 uRes;
uniform vec3 uCam;
out vec2 vOff;
out float vR;
out float vLW;
out vec4 vFill;
out vec4 vLine;
void main() {
  float rpx = aCircle.z * uCam.z;
  float pad = rpx + 1.5;
  vec2 c = (aCircle.xy - uCam.xy) * uCam.z + uRes * 0.5;
  vec2 p = c + aPosition * pad;
  vOff = aPosition * pad;
  vR = rpx;
  vLW = aLineW;
  vFill = aFill;
  vLine = aLine;
  gl_Position = vec4(p.x / uRes.x * 2.0 - 1.0, 1.0 - p.y / uRes.y * 2.0, 0.0, 1.0);
}`;

const FRAGMENT = `
precision highp float;
in vec2 vOff;
in float vR;
in float vLW;
in vec4 vFill;
in vec4 vLine;
out vec4 finalColor;
void main() {
  float d = length(vOff) - vR;
  float inside = clamp(0.5 - d, 0.0, 1.0);
  float fa = vFill.a * inside;
  vec4 f = vec4(vFill.rgb * fa, fa);
  float ring = vLW > 0.0 ? clamp(0.5 - abs(d + vLW * 0.5) + vLW * 0.5, 0.0, 1.0) : 0.0;
  float la = ring * vLine.a;
  vec4 l = vec4(vLine.rgb * la, la);
  finalColor = l + f * (1.0 - l.a);
}`;

const FONT_NAME = "TTTreeLabel";

export class PixiRenderer implements TreeRenderer {
  readonly name = "pixi" as const;
  readonly firstFrame: Promise<void>;
  private resolveFirst!: () => void;
  private app!: Application;
  private mesh!: Mesh<Geometry, Shader>;
  private geometry!: Geometry;
  private circleBuf!: Buffer;
  private fillBuf!: Buffer;
  private lineBuf!: Buffer;
  private lineWBuf!: Buffer;
  private circleData = new Float32Array(0);
  private uniforms!: UniformGroup;
  private uni!: { uRes: Float32Array; uCam: Float32Array };
  private labelLayer = new Container();
  private pool: BitmapText[] = [];
  private shown = 0;
  private lastVersion = -1;
  private lastCap = 0;
  private drawnFirst = false;
  private opts!: RendererInit;
  private palette!: Palette;
  private fontKey = "";
  private alive = true;

  constructor() {
    this.firstFrame = new Promise((res) => (this.resolveFirst = res));
  }

  async init(opts: RendererInit): Promise<void> {
    this.opts = opts;
    this.palette = opts.palette;
    const app = new Application();
    await app.init({
      canvas: opts.canvas,
      width: opts.size.w,
      height: opts.size.h,
      resolution: opts.dpr,
      autoDensity: true,
      antialias: false,
      backgroundAlpha: 0,
      preference: "webgl",
      powerPreference: "high-performance",
      autoStart: false,
      sharedTicker: false,
    });
    if (!this.alive) {
      app.destroy(false, { children: true });
      return;
    }
    this.app = app;
    this.uniforms = new UniformGroup({
      uRes: { value: new Float32Array([opts.size.w, opts.size.h]), type: "vec2<f32>" },
      uCam: { value: new Float32Array([0, 0, 1]), type: "vec3<f32>" },
    });
    this.uni = this.uniforms.uniforms as { uRes: Float32Array; uCam: Float32Array };
    this.buildGeometry(32768);
    const shader = Shader.from({ gl: { vertex: VERTEX, fragment: FRAGMENT }, resources: { circleUniforms: this.uniforms } });
    this.mesh = new Mesh({ geometry: this.geometry, shader });
    this.mesh.boundsArea = new Rectangle(0, 0, opts.size.w, opts.size.h);
    app.stage.addChild(this.mesh);
    app.stage.addChild(this.labelLayer);
    this.installFont(opts.layout.name, opts.dpr);
  }

  private buildGeometry(cap: number): void {
    this.circleData = new Float32Array(cap * 3);
    this.circleBuf = new Buffer({ data: this.circleData, usage: BufferUsage.VERTEX | BufferUsage.COPY_DST });
    this.fillBuf = new Buffer({ data: new Uint8Array(cap * 4), usage: BufferUsage.VERTEX | BufferUsage.COPY_DST });
    this.lineBuf = new Buffer({ data: new Uint8Array(cap * 4), usage: BufferUsage.VERTEX | BufferUsage.COPY_DST });
    this.lineWBuf = new Buffer({ data: new Float32Array(cap), usage: BufferUsage.VERTEX | BufferUsage.COPY_DST });
    const geometry = new Geometry({
      attributes: {
        aPosition: { buffer: new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]), format: "float32x2", stride: 8, offset: 0 },
        aCircle: { buffer: this.circleBuf, format: "float32x3", stride: 12, offset: 0, instance: true },
        aFill: { buffer: this.fillBuf, format: "unorm8x4", stride: 4, offset: 0, instance: true },
        aLine: { buffer: this.lineBuf, format: "unorm8x4", stride: 4, offset: 0, instance: true },
        aLineW: { buffer: this.lineWBuf, format: "float32", stride: 4, offset: 0, instance: true },
      },
      indexBuffer: new Uint16Array([0, 1, 2, 0, 2, 3]),
      instanceCount: 0,
      topology: "triangle-list",
    });
    this.geometry = geometry;
    if (this.mesh) this.mesh.geometry = geometry;
    this.lastCap = cap;
    this.lastVersion = -1;
  }

  private installFont(names: string[], dpr: number): void {
    const chars = new Set<string>([" "]);
    for (const nm of names) for (const ch of nm) chars.add(ch);
    const ink = this.palette.ink;
    const halo = this.palette.canvas;
    const key = `${ink.join(",")}|${halo.join(",")}|${dpr}`;
    if (key === this.fontKey) return;
    if (this.fontKey) {
      for (const t of this.pool) t.destroy();
      this.pool = [];
      this.shown = 0;
      BitmapFont.uninstall(FONT_NAME);
    }
    BitmapFont.install({
      name: FONT_NAME,
      chars: Array.from(chars),
      resolution: dpr,
      padding: 2,
      skipKerning: true,
      style: {
        fontFamily: this.opts.fontFamily,
        fontSize: LOD.LABEL_FONT_PX,
        fontWeight: "500",
        fill: rgbHex(ink),
        stroke: { color: rgbHex(halo), width: 3, join: "round" },
      },
    });
    this.fontKey = key;
  }

  setPalette(palette: Palette): void {
    this.palette = palette;
    if (this.app) {
      this.installFont(this.opts.layout.name, this.opts.dpr);
      this.lastVersion = -1;
    }
  }

  resize(size: Size, dpr: number): void {
    if (!this.app) return;
    this.opts = { ...this.opts, size, dpr };
    this.app.renderer.resize(size.w, size.h, dpr);
    this.uni.uRes[0] = size.w;
    this.uni.uRes[1] = size.h;
    this.mesh.boundsArea = new Rectangle(0, 0, size.w, size.h);
    this.installFont(this.opts.layout.name, dpr);
    this.lastVersion = -1;
  }

  render(scene: Scene, cam: Camera, size: Size): void {
    if (!this.app) return;
    const n = scene.count;
    if (scene.cap !== this.lastCap) this.buildGeometry(scene.cap);
    if (scene.version !== this.lastVersion) {
      const d = this.circleData;
      for (let i = 0; i < n; i++) {
        d[i * 3] = scene.x[i]!;
        d[i * 3 + 1] = scene.y[i]!;
        d[i * 3 + 2] = scene.r[i]!;
      }
      this.circleBuf.update(n * 12);
      this.fillBuf.data = scene.fill;
      this.fillBuf.update(n * 4);
      this.lineBuf.data = scene.line;
      this.lineBuf.update(n * 4);
      this.lineWBuf.data = scene.lineW;
      this.lineWBuf.update(n * 4);
      this.geometry.instanceCount = n;
      this.lastVersion = scene.version;
      this.syncLabelPool(scene);
    }
    const u = this.uni;
    u.uCam[0] = cam.cx;
    u.uCam[1] = cam.cy;
    u.uCam[2] = cam.scale;
    this.uniforms.update();
    this.placeLabels(scene, cam, size);
    this.app.render();
    if (!this.drawnFirst) {
      this.drawnFirst = true;
      requestAnimationFrame(() => this.resolveFirst());
    }
  }

  private syncLabelPool(scene: Scene): void {
    const names = this.opts.layout.name;
    while (this.pool.length < scene.labelCount) {
      const t = new BitmapText({ text: "", style: { fontFamily: FONT_NAME, fontSize: LOD.LABEL_FONT_PX } });
      t.anchor.set(0.5, 0.5);
      t.visible = false;
      this.labelLayer.addChild(t);
      this.pool.push(t);
    }
    for (let k = 0; k < scene.labelCount; k++) {
      const t = this.pool[k]!;
      const text = names[scene.labelId[k]!]!;
      if (t.text !== text) t.text = text;
      t.alpha = scene.labelAlpha[k]!;
    }
    for (let k = scene.labelCount; k < this.shown; k++) this.pool[k]!.visible = false;
    this.shown = scene.labelCount;
  }

  private placeLabels(scene: Scene, cam: Camera, size: Size): void {
    const { x, y, r } = this.opts.layout;
    const dpr = this.opts.dpr;
    for (let k = 0; k < scene.labelCount; k++) {
      const v = scene.labelId[k]!;
      const sx = (x[v]! - cam.cx) * cam.scale + size.w / 2;
      let sy = (y[v]! - cam.cy) * cam.scale + size.h / 2;
      if (scene.labelKind[k] === LABEL_KIND_TOP) sy += -r[v]! * cam.scale + LOD.LABEL_FONT_PX;
      const t = this.pool[k]!;
      t.position.set(Math.round(sx * dpr) / dpr, Math.round(sy * dpr) / dpr);
      t.visible = true;
    }
  }

  labelsDrawn(): number {
    return this.shown;
  }

  destroy(): void {
    this.alive = false;
    if (!this.app) return;
    try {
      BitmapFont.uninstall(FONT_NAME);
    } catch {
      /* not installed */
    }
    // Keep the canvas element: React owns it.
    this.app.destroy(false, { children: true });
  }
}
