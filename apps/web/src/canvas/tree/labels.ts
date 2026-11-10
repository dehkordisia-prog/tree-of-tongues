// Label collision avoidance. Pure: candidates in, accepted indices out.
//
// Greedy by priority: nodes on the focused path first, then scope languages, then larger circles.
// A candidate is accepted when its box does not touch any accepted box, until the cap is reached.
// Boxes are estimated from the name length (the font is proportional, so this is an estimate with a
// margin, not a measurement). A small spatial hash keeps the pass near linear.

export interface LabelCandidate {
  /** Screen position of the label center, CSS px. */
  x: number;
  y: number;
  /** Estimated width and height, CSS px. */
  w: number;
  h: number;
  /** Higher wins. */
  priority: number;
  /** Screen radius of the node; larger wins among equal priorities. */
  rs: number;
  /** Node id; breaks the last ties so the result is deterministic. */
  id: number;
}

const CELL = 64;

/** Indices into `cands` of the labels to draw, best first. */
export function selectLabels(cands: readonly LabelCandidate[], max: number, gap = 2): number[] {
  const order = cands.map((_, i) => i);
  order.sort((a, b) => {
    const p = cands[a]!;
    const q = cands[b]!;
    return q.priority - p.priority || q.rs - p.rs || p.id - q.id;
  });
  const grid = new Map<number, number[]>();
  const accepted: number[] = [];
  const key = (cx: number, cy: number) => cx * 73856093 + cy * 19349663;
  for (const i of order) {
    if (accepted.length >= max) break;
    const c = cands[i]!;
    const x0 = c.x - c.w / 2 - gap;
    const x1 = c.x + c.w / 2 + gap;
    const y0 = c.y - c.h / 2 - gap;
    const y1 = c.y + c.h / 2 + gap;
    const cx0 = Math.floor(x0 / CELL);
    const cx1 = Math.floor(x1 / CELL);
    const cy0 = Math.floor(y0 / CELL);
    const cy1 = Math.floor(y1 / CELL);
    let hit = false;
    for (let cx = cx0; cx <= cx1 && !hit; cx++) {
      for (let cy = cy0; cy <= cy1 && !hit; cy++) {
        const cell = grid.get(key(cx, cy));
        if (!cell) continue;
        for (const j of cell) {
          const o = cands[j]!;
          if (x0 < o.x + o.w / 2 && x1 > o.x - o.w / 2 && y0 < o.y + o.h / 2 && y1 > o.y - o.h / 2) {
            hit = true;
            break;
          }
        }
      }
    }
    if (hit) continue;
    accepted.push(i);
    for (let cx = cx0; cx <= cx1; cx++) {
      for (let cy = cy0; cy <= cy1; cy++) {
        const k = key(cx, cy);
        const cell = grid.get(k);
        if (cell) cell.push(i);
        else grid.set(k, [i]);
      }
    }
  }
  return accepted;
}
