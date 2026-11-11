// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Макс
/** Derived quantities of tools 5–9 (memoised like tools/compute.ts). */
import { localBasis, metricAt, type Chart, type Frame } from "../geometry/chart";
import { axisStep } from "../geometry/grid";
import { col, det, mulV, type M2, type V2 } from "../geometry/linalg";
import { insideDomain } from "../geometry/wrap";
import { fieldFor } from "../numeric/field";
import {
  curvatureInEllipse,
  curvatureInStrip,
  geodesicFan,
  orientedAngle,
  parallelTransport,
  raySeparation,
  wrapAngle,
  type Ray,
  type TransportStep,
} from "../numeric/transport";
import { compileAnalysis, type Params } from "../symbolic/compile";
import { probeQ } from "./compute";

function memoLast<A extends unknown[], R>(fn: (...a: A) => R): (...a: A) => R {
  let lastArgs: A | null = null;
  let last: R;
  return (...a: A) => {
    if (lastArgs && a.length === lastArgs.length && a.every((x, i) => x === lastArgs![i])) return last;
    lastArgs = a;
    last = fn(...a);
    return last;
  };
}

const TAU = 2 * Math.PI;

/** World vector of contravariant components v at q (abstract charts: the components themselves). */
export function worldVec(chart: Chart, frame: Frame, p: Params, q: V2, v: V2): V2 {
  return mulV(localBasis(chart, frame, q, p), v);
}

// --------------------------------------------------------- 5. Christoffel
export interface ChristoffelInfo {
  q: V2;
  gamma: number[]; // Γ^l_{mn} at P, flat 4l + 2m + n
  /** ∂_j e_i = Γ^k_{ij} e_k as world vectors, for i = 1, 2 (j = chosen direction). */
  predicted: [V2, V2];
  /** The same by finite differences of the drawn basis (embedded charts). */
  measured: [V2, V2] | null;
}

export const christoffelInfo = memoLast((chart: Chart, frame: Frame, p: Params, probe: V2, j: 0 | 1): ChristoffelInfo => {
  const q = probeQ(chart, probe);
  const gamma = compileAnalysis(chart.analysis).christoffel(q, p);
  const E = localBasis(chart, frame, q, p);
  const predicted = [0, 1].map((i) => {
    const comps: V2 = [gamma[4 * 0 + 2 * i + j], gamma[4 * 1 + 2 * i + j]];
    return mulV(E, comps);
  }) as [V2, V2];
  let measured: [V2, V2] | null = null;
  if (chart.kind === "embedded") {
    const h = 1e-4;
    const qp: V2 = [...q];
    const qm: V2 = [...q];
    qp[j] += h;
    qm[j] -= h;
    const Ep = localBasis(chart, frame, qp, p);
    const Em = localBasis(chart, frame, qm, p);
    measured = [0, 1].map((i) => {
      const a = col(Ep, i as 0 | 1);
      const b = col(Em, i as 0 | 1);
      return [(a[0] - b[0]) / (2 * h), (a[1] - b[1]) / (2 * h)] as V2;
    }) as [V2, V2];
  }
  return { q, gamma, predicted, measured };
});

// ------------------------------------------------------ 6. parallel transport
export interface TransportInfo {
  steps: TransportStep[];
  loop: V2[]; // the loop in chart coordinates
  angle: number; // holonomy (oriented, metric)
  flux: number | null; // ∬ K dA of the enclosed region (null if the loop bounds no disc)
  fluxNote: "disc" | "cap" | "none";
}

export const transportInfo = memoLast(
  (chart: Chart, frame: Frame, p: Params, probe: V2, kind: "circle" | "line", r: number, v0: V2): TransportInfo => {
    const field = fieldFor(chart, frame, p);
    const c = compileAnalysis(chart.analysis);
    const K = (q: V2) => c.scalar(q, p)[0] / 2;
    const sqrtG = (q: V2) => Math.sqrt(Math.abs(det(metricAt(chart, frame, q, p))));
    const P = probeQ(chart, probe);
    const ax1 = chart.display.axes[1];
    let q: (t: number) => V2;
    let dq: (t: number) => V2;
    let flux: number | null = null;
    let fluxNote: TransportInfo["fluxNote"] = "disc";
    if (kind === "line" && ax1.periodic) {
      const [lo, hi] = ax1.range;
      const per = hi - lo;
      q = (t) => [P[0], P[1] + per * t];
      dq = () => [0, per];
      // the strip from the lower edge of q¹ to P¹ is a disc only if that edge is a pole (sphere)
      const lower = chart.analysis.domain?.[0]?.[0] ?? chart.display.axes[0].range[0];
      const pole = chart.id === "sphere" || chart.id === "polar" || chart.id === "elliptic";
      if (pole) {
        fluxNote = "cap";
        flux = curvatureInStrip(K, sqrtG, lower, P[0], lo, hi);
      } else {
        fluxNote = "none";
      }
    } else {
      const rho: V2 = [r * axisStep(chart, 0) * 0.5, r * axisStep(chart, 1) * 0.5];
      q = (t) => [P[0] + rho[0] * Math.cos(TAU * t), P[1] + rho[1] * Math.sin(TAU * t)];
      dq = (t) => [-TAU * rho[0] * Math.sin(TAU * t), TAU * rho[1] * Math.cos(TAU * t)];
      flux = curvatureInEllipse(K, sqrtG, P, rho);
    }
    const steps = parallelTransport(field, q, dq, v0, 480);
    const loop = steps.map((s) => s.q);
    const angle = orientedAngle(field.g(steps[0].q), v0, steps[steps.length - 1].v);
    return { steps, loop, angle, flux, fluxNote };
  },
);

export { wrapAngle };

// ------------------------------------------------------- 7. geodesic fan
export interface FanInfo {
  rays: Ray[];
  separation: { s: number; d: number }[];
  dAlpha: number;
}

export const FAN_COUNT = 17;

export const fanInfo = memoLast(
  (chart: Chart, frame: Frame, p: Params, probe: V2, alpha: number, spread: number, length: number): FanInfo => {
    const field = fieldFor(chart, frame, p);
    const P = probeQ(chart, probe);
    const rays = geodesicFan(field, P, alpha, spread, FAN_COUNT, length, (q) => insideDomain(chart, q), 360);
    // a thin pair around the centre (Δα = 0.01) for the geodesic deviation plot
    const pair = geodesicFan(field, P, alpha, 0.005, 2, length, (q) => insideDomain(chart, q), 360);
    return { rays, separation: raySeparation(field, pair[0], pair[1]), dAlpha: 0.01 };
  },
);

// ------------------------------------------------------------ 8. curvature
export interface CurvatureGrid {
  nx: number;
  ny: number;
  q0: V2;
  dq: V2;
  R: Float64Array; // scalar curvature per cell centre
  maxAbs: number;
}

export const curvatureGrid = memoLast((chart: Chart, p: Params, nx: number, ny: number): CurvatureGrid => {
  const scalar = compileAnalysis(chart.analysis).scalar;
  const [a, b] = chart.display.axes;
  const lo: V2 = [a.min ?? a.range[0], b.min ?? b.range[0]];
  const dq: V2 = [(a.range[1] - lo[0]) / nx, (b.range[1] - lo[1]) / ny];
  const R = new Float64Array(nx * ny);
  let maxAbs = 0;
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < ny; j++) {
      const v = scalar([lo[0] + (i + 0.5) * dq[0], lo[1] + (j + 0.5) * dq[1]], p)[0];
      R[i * ny + j] = v;
      if (Number.isFinite(v)) maxAbs = Math.max(maxAbs, Math.abs(v));
    }
  return { nx, ny, q0: lo, dq, R, maxAbs };
});

export function scalarAt(chart: Chart, p: Params, q: V2): number {
  return compileAnalysis(chart.analysis).scalar(q, p)[0];
}

/** Diverging colour for t ∈ [−1, 1]: blue (negative) ↔ dark neutral ↔ red (positive). */
export function divergingRgba(t: number, maxAlpha = 0.62): string {
  const a = Math.min(1, Math.abs(t)) * maxAlpha;
  return t < 0 ? `rgba(57,135,229,${a})` : `rgba(230,103,103,${a})`;
}

export function metricAtProbe(chart: Chart, frame: Frame, p: Params, probe: V2): M2 {
  return metricAt(chart, frame, probeQ(chart, probe), p);
}
