// Languoid counts per node from tree.json (languages and dialects in the subtree; never speakers).
// Pure counting plus a lazy client loader that fetches tree.json once.

export type TreeNodeRow = [glottocode: string, parentIndex: number, level: number, name: string, childCount: number, ...rest: unknown[]];

export interface TreeCounts {
  /** glottocode -> [languages, dialects] below the node (the node itself not counted). */
  counts: Map<string, [number, number]>;
  /** glottocode -> [Glottolog name, level 0 family, 1 language, 2 dialect]. */
  nodes: Map<string, [string, number]>;
  /** Top-level families by language count, largest first. */
  top: { g: string; name: string; languages: number }[];
  /** The raw rows (search builds its tier-2 documents from them). */
  rows: readonly TreeNodeRow[];
}

export function countTree(rows: readonly TreeNodeRow[]): TreeCounts {
  const n = rows.length;
  const lang = new Uint32Array(n);
  const dial = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    const level = rows[i]![2];
    if (level !== 1 && level !== 2) continue;
    for (let p = rows[i]![1], guard = 0; p >= 0 && guard < 200; p = rows[p]![1], guard++) {
      if (level === 1) lang[p]!++;
      else dial[p]!++;
    }
  }
  const counts = new Map<string, [number, number]>();
  const nodes = new Map<string, [string, number]>();
  const top: TreeCounts["top"] = [];
  for (let i = 0; i < n; i++) {
    const r = rows[i]!;
    counts.set(r[0], [lang[i]!, dial[i]!]);
    nodes.set(r[0], [r[3], r[2]]);
    if (r[1] < 0 && r[2] === 0) top.push({ g: r[0], name: r[3], languages: lang[i]! });
  }
  top.sort((a, b) => b.languages - a.languages || a.name.localeCompare(b.name, "en"));
  return { counts, nodes, top, rows };
}

let pending: Promise<TreeCounts | null> | null = null;

export function loadTreeCounts(): Promise<TreeCounts | null> {
  pending ??= fetch("/data/tree.json")
    .then(async (res) => {
      if (!res.ok || (res.headers.get("content-type") ?? "").includes("text/html")) return null;
      const file = (await res.json()) as { nodes?: TreeNodeRow[] };
      return Array.isArray(file.nodes) ? countTree(file.nodes) : null;
    })
    .catch(() => null)
    .then((r) => {
      if (!r) pending = null; // a later call may find the file after a rebuild
      return r;
    });
  return pending;
}
