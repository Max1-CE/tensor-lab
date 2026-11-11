// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Макс
/** Draw curves on abstract charts with periodic coordinates (sphere φ, torus u, v). */
import type { Chart } from "./chart";
import type { V2 } from "./linalg";

/** Wrap periodic coordinates into the display range and split where a curve wraps. */
export function splitWrapped(chart: Chart, qs: V2[]): V2[][] {
  const axes = chart.display.axes;
  if (chart.kind === "embedded" || !axes.some((a) => a.periodic)) return [qs];
  const wrap = (q: V2): V2 =>
    q.map((x, i) => {
      const a = axes[i];
      if (!a.periodic) return x;
      const [lo, hi] = a.range;
      const w = hi - lo;
      return lo + ((((x - lo) % w) + w) % w);
    }) as V2;
  const out: V2[][] = [];
  let cur: V2[] = [];
  let prev: V2 | null = null;
  for (const q of qs) {
    const w = wrap(q);
    if (prev && axes.some((a, i) => a.periodic && Math.abs(w[i] - prev![i]) > (a.range[1] - a.range[0]) / 2)) {
      if (cur.length > 1) out.push(cur);
      cur = [];
    }
    cur.push(w);
    prev = w;
  }
  if (cur.length > 1) out.push(cur);
  return out;
}

/** Inside the non-periodic part of the display domain? */
export function insideDomain(chart: Chart, q: V2): boolean {
  return chart.display.axes.every((a, i) => a.periodic || (q[i] >= a.range[0] - 1e-9 && q[i] <= a.range[1] + 1e-9));
}
