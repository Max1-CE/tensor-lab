// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Макс
/**
 * A 2D chart as drawn on the canvas.
 *
 * "Embedded" charts (Cartesian, polar, …) come with a map X: q → ℝ²; the
 * picture is O + A·X(q), where A = [e₁ e₂] is the linear frame the user drags.
 * The metric is then the pullback g = (A J)ᵀ (A J), J = ∂X/∂q.
 *
 * "Abstract" charts (a user-typed metric) have no embedding: the canvas shows
 * the coordinate plane itself and the metric only through its indicatrices.
 */
import { compileAnalysis, defaultParams, type Params, type VecFn } from "../symbolic/compile";
import type { Analysis } from "../symbolic/types";
import { I2, add, clamp, fromCols, gram, inv, mul, mulV, sub, type M2, type V2 } from "./linalg";

export interface Frame {
  O: V2; // world position of X(0)
  A: M2; // linear frame, columns are the images of the Cartesian unit vectors
}

export const IDENTITY_FRAME: Frame = { O: [0, 0], A: I2 };

export interface AxisDisplay {
  range: [number, number];
  lines: number; // number of coordinate lines of this coordinate
  periodic: boolean;
  /** Smallest allowed value for the probe (e.g. r > 0 to avoid the pole). */
  min?: number;
}

export interface ChartDisplay {
  axes: [AxisDisplay, AxisDisplay];
  /** Affine charts: the probe point is pinned to the origin. */
  affine: boolean;
  probe: V2;
}

export interface Chart {
  id: string;
  title: string;
  analysis: Analysis;
  display: ChartDisplay;
  kind: "embedded" | "abstract";
  embed: (q: V2, p: Params) => V2;
  metricFn: VecFn;
  defaults: Params;
}

const TAU = 2 * Math.PI;
const ax = (lo: number, hi: number, lines: number, extra: Partial<AxisDisplay> = {}): AxisDisplay => ({
  range: [lo, hi],
  lines,
  periodic: false,
  ...extra,
});

/** Display settings per preset (ranges larger than the default view). */
export const DISPLAY: Record<string, ChartDisplay> = {
  cartesian: { axes: [ax(-10, 10, 21), ax(-10, 10, 21)], affine: true, probe: [0, 0] },
  skew: { axes: [ax(-12, 12, 25), ax(-12, 12, 25)], affine: true, probe: [0, 0] },
  polar: {
    axes: [ax(0, 10, 21, { min: 0.05 }), ax(0, TAU, 24, { periodic: true })],
    affine: false,
    probe: [2, Math.PI / 4],
  },
  elliptic: {
    axes: [ax(0, 3, 16, { min: 0.02 }), ax(0, TAU, 24, { periodic: true })],
    affine: false,
    probe: [1, Math.PI / 3],
  },
  parabolic: {
    axes: [ax(-4.5, 4.5, 19), ax(0, 4.5, 10, { min: 0.02 })],
    affine: false,
    probe: [1, 1.2],
  },
};

export function displayFor(id: string, analysis: Analysis): ChartDisplay {
  if (DISPLAY[id]) return DISPLAY[id];
  const d = analysis.domain ?? [[-4, 4], [-4, 4]];
  return {
    axes: [ax(d[0][0], d[0][1], 17), ax(d[1][0], d[1][1], 17)],
    affine: false,
    probe: [(d[0][0] + d[0][1]) / 2 + 0.37, (d[1][0] + d[1][1]) / 2 + 0.29],
  };
}

export function makeChart(analysis: Analysis, display?: ChartDisplay, id = analysis.id ?? analysis.name): Chart {
  const c = compileAnalysis(analysis);
  if (c.dim !== 2) throw new RangeError("the 2D canvas needs a 2D chart");
  const embedFn = c.embedding;
  const embedded = !!embedFn && analysis.kind === "plane";
  return {
    id,
    title: analysis.title ?? id,
    analysis,
    display: display ?? displayFor(id, analysis),
    kind: embedded ? "embedded" : "abstract",
    embed: embedded ? (q, p) => embedFn!(q, p) as V2 : (q) => [q[0], q[1]],
    metricFn: c.metric,
    defaults: defaultParams(analysis),
  };
}

// ----------------------------------------------------------------- geometry
/** Columns ∂X/∂q¹, ∂X/∂q² by central differences. */
export function jacobian(chart: Chart, q: V2, p: Params): M2 {
  const cols: V2[] = [0, 1].map((i) => {
    const h = 1e-6 * Math.max(1, Math.abs(q[i]));
    const qp: V2 = [...q];
    const qm: V2 = [...q];
    qp[i] += h;
    qm[i] -= h;
    const a = chart.embed(qp, p);
    const b = chart.embed(qm, p);
    return [(a[0] - b[0]) / (2 * h), (a[1] - b[1]) / (2 * h)];
  });
  return fromCols(cols[0], cols[1]);
}

export function toWorld(chart: Chart, f: Frame, q: V2, p: Params): V2 {
  return add(f.O, mulV(f.A, chart.embed(q, p)));
}

/** Local basis e_i = ∂(world)/∂q^i as matrix columns. */
export function localBasis(chart: Chart, f: Frame, q: V2, p: Params): M2 {
  if (chart.kind === "abstract") return f.A;
  return mul(f.A, jacobian(chart, q, p));
}

/** g_ij at q. Embedded: Gram matrix of the drawn local basis. Abstract: the given metric. */
export function metricAt(chart: Chart, f: Frame, q: V2, p: Params): M2 {
  if (chart.kind === "abstract") return chart.metricFn(q, p) as M2;
  return gram(localBasis(chart, f, q, p));
}

/** New frame such that the local basis at q becomes E (columns). */
export function frameWithLocalBasis(chart: Chart, f: Frame, q: V2, p: Params, E: M2): Frame {
  const J = chart.kind === "abstract" ? I2 : jacobian(chart, q, p);
  const A = mul(E, inv(J));
  // keep the probe point fixed on screen while the frame changes
  const before = toWorld(chart, f, q, p);
  const after = add(f.O, mulV(A, chart.embed(q, p)));
  return { A, O: add(f.O, sub(before, after)) };
}

export function clampToDomain(chart: Chart, q: V2): V2 {
  const out: V2 = [q[0], q[1]];
  chart.display.axes.forEach((a, i) => {
    if (a.periodic) {
      const [lo, hi] = a.range;
      const w = hi - lo;
      out[i] = lo + ((((out[i] - lo) % w) + w) % w);
    } else {
      out[i] = clamp(out[i], a.min ?? a.range[0], a.range[1]);
    }
  });
  return out;
}

/** Solve toWorld(q) = w by damped Newton, starting from `guess`. */
export function fromWorld(chart: Chart, f: Frame, w: V2, guess: V2, p: Params): V2 {
  let q = clampToDomain(chart, guess);
  for (let it = 0; it < 40; it++) {
    const r = sub(toWorld(chart, f, q, p), w);
    if (Math.hypot(r[0], r[1]) < 1e-10) break;
    let J: M2;
    try {
      J = inv(localBasis(chart, f, q, p));
    } catch {
      break; // singular point (e.g. r = 0): stay where we are
    }
    let step = mulV(J, r);
    const n = Math.hypot(step[0], step[1]);
    const maxStep = 0.5;
    if (n > maxStep) step = [(step[0] * maxStep) / n, (step[1] * maxStep) / n];
    q = clampToDomain(chart, sub(q, step));
  }
  return q;
}
