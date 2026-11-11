// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Макс
/**
 * A metric field on a 2D chart: g_ij(q) and Γ^l_{mn}(q).
 *
 * For embedded flat charts the picture is O + A·X(q). The metric depends on the
 * linear frame A, but Γ^l_{mn} = (J⁻¹)^l_a ∂_m∂_n X^a does not (A cancels), so
 * the compiled symbolic Γ stays valid while the user drags e₁, e₂.
 */
import { metricAt, type Chart, type Frame } from "../geometry/chart";
import { inv, type M2, type V2 } from "../geometry/linalg";
import { compileAnalysis, type Params } from "../symbolic/compile";

export interface MetricField {
  g(q: V2): M2;
  /** Flat [l][m][n] → index 4l + 2m + n. */
  christoffel(q: V2): number[];
}

export function fieldFor(chart: Chart, frame: Frame, p: Params): MetricField {
  const c = compileAnalysis(chart.analysis);
  return {
    g: (q) => metricAt(chart, frame, q, p),
    christoffel: (q) => c.christoffel(q, p),
  };
}

/** Γ by central differences of g (used to cross-check the symbolic Γ). */
export function numericChristoffel(g: (q: V2) => M2, q: V2, h = 1e-4): number[] {
  const dg: M2[] = [0, 1].map((k) => {
    const qp: V2 = [...q];
    const qm: V2 = [...q];
    qp[k] += h;
    qm[k] -= h;
    const a = g(qp);
    const b = g(qm);
    return a.map((x, i) => (x - b[i]) / (2 * h)) as M2;
  });
  const gi = inv(g(q));
  const at = (m: M2, i: number, j: number) => m[2 * i + j];
  const out = new Array<number>(8).fill(0);
  for (let l = 0; l < 2; l++)
    for (let m = 0; m < 2; m++)
      for (let n = 0; n < 2; n++) {
        let s = 0;
        for (let k = 0; k < 2; k++) s += at(gi, l, k) * (at(dg[m], k, n) + at(dg[n], k, m) - at(dg[k], m, n));
        out[4 * l + 2 * m + n] = s / 2;
      }
  return out;
}

/** g(u, w) = g_ij u^i w^j */
export const inner = (g: M2, u: V2, w: V2): number =>
  g[0] * u[0] * w[0] + g[1] * u[0] * w[1] + g[2] * u[1] * w[0] + g[3] * u[1] * w[1];

/** Lower an index: v_i = g_ij v^j */
export const lower = (g: M2, v: V2): V2 => [g[0] * v[0] + g[1] * v[1], g[2] * v[0] + g[3] * v[1]];
