// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Макс
/**
 * Derived quantities of tools 1–4. Shared by the SVG overlay and the panels;
 * each function memoises its last call, so both read the same result per frame.
 */
import { localBasis, metricAt, toWorld, type Chart, type Frame } from "../geometry/chart";
import { det, inv, mul, mulV, norm, type M2, type V2 } from "../geometry/linalg";
import { coordinateSegmentLength, integrate, shootTo, type BvpResult } from "../numeric/curves";
import { fieldFor, inner, lower } from "../numeric/field";
import type { Params } from "../symbolic/compile";

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

export const probeQ = (chart: Chart, probe: V2): V2 => (chart.display.affine ? [0, 0] : probe);

/** Coordinates of a world vector in the basis E (contravariant components). */
export const contravariant = (E: M2, w: V2): V2 => mulV(inv(E), w);

// ------------------------------------------------------------- tool 1: metric
export interface MetricInfo {
  q: V2;
  g: M2;
  gInv: M2;
  det: number;
  sqrtG: number;
  delta: M2; // g^{ik} g_{kj}, should be the identity
  cell: { d: V2; exact: number; approx: number };
}

export const metricInfo = memoLast(
  (chart: Chart, frame: Frame, p: Params, probe: V2, frac: number, step0: number, step1: number): MetricInfo => {
    const q = probeQ(chart, probe);
    const g = metricAt(chart, frame, q, p);
    const gInv = inv(g);
    const dg = det(g);
    const sqrtG = Math.sqrt(Math.abs(dg));
    const d: V2 = [frac * step0, frac * step1];
    const area = (x: V2) => Math.sqrt(Math.abs(det(metricAt(chart, frame, x, p))));
    // ∬ √g dq¹dq² over the cell [q, q + d] with corner P (nested Gauss–Legendre)
    const exact = integrate(
      (s) => integrate((t) => area([q[0] + s * d[0], q[1] + t * d[1]]), 0, 1, 4),
      0,
      1,
      4,
    ) * d[0] * d[1];
    return { q, g, gInv, det: dg, sqrtG, delta: mul(gInv, g), cell: { d, exact, approx: sqrtG * d[0] * d[1] } };
  },
);

// ------------------------------------------------------------- tool 2: length
export interface LengthInfo {
  coord: number;
  geo: BvpResult | null;
  /** B shifted by whole periods so that the geodesic takes the short way. */
  target: V2;
  /** Straight-line distance in the plane (embedded charts only). */
  chord: number | null;
}

let lastV0: V2 | undefined;

export const lengthInfo = memoLast((chart: Chart, frame: Frame, p: Params, A: V2, B: V2): LengthInfo => {
  const field = fieldFor(chart, frame, p);
  const target: V2 = [B[0], B[1]];
  chart.display.axes.forEach((ax, i) => {
    if (!ax.periodic) return;
    const per = ax.range[1] - ax.range[0];
    while (target[i] - A[i] > per / 2) target[i] -= per;
    while (target[i] - A[i] < -per / 2) target[i] += per;
  });
  let geo = shootTo(field, A, target, { guess: lastV0 });
  if (!geo.converged && lastV0) geo = shootTo(field, A, target); // retry from the straight guess
  lastV0 = geo.converged ? geo.v0 : undefined;
  let chord: number | null = null;
  if (chart.kind === "embedded") {
    const a = toWorld(chart, frame, A, p);
    const b = toWorld(chart, frame, B, p);
    chord = Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return { coord: coordinateSegmentLength(field, A, B), geo: geo.converged ? geo : null, target, chord };
});

// ------------------------------------------------------------- tool 3: vector
export interface VectorInfo {
  P: V2; // world position of the probe
  E: M2; // basis at P (columns)
  Edual: M2; // dual basis e^i = g^{ij} e_j (columns)
  g: M2;
  gInv: M2;
  up: V2; // v^i
  down: V2; // v_i
  norm2: number;
}

export const vectorInfo = memoLast((chart: Chart, frame: Frame, p: Params, probe: V2, v: V2): VectorInfo => {
  const q = probeQ(chart, probe);
  const E = localBasis(chart, frame, q, p);
  const g = metricAt(chart, frame, q, p);
  const gInv = inv(g);
  const up = contravariant(E, v);
  const down = lower(g, up);
  return {
    P: toWorld(chart, frame, q, p),
    E,
    Edual: mul(E, gInv),
    g,
    gInv,
    up,
    down,
    norm2: inner(g, up, up),
  };
});

// -------------------------------------------------------------- tool 4: angle
export interface AngleInfo {
  P: V2;
  up: [V2, V2];
  dot: number; // g(u, w)
  norms: V2;
  cos: number;
  angle: number; // by the metric
  drawn: number; // Euclidean angle of the drawn arrows
}

export const angleInfo = memoLast((chart: Chart, frame: Frame, p: Params, probe: V2, u: V2, w: V2): AngleInfo => {
  const q = probeQ(chart, probe);
  const E = localBasis(chart, frame, q, p);
  const g = metricAt(chart, frame, q, p);
  const uc = contravariant(E, u);
  const wc = contravariant(E, w);
  const dot = inner(g, uc, wc);
  const norms: V2 = [Math.sqrt(inner(g, uc, uc)), Math.sqrt(inner(g, wc, wc))];
  const cos = Math.max(-1, Math.min(1, dot / (norms[0] * norms[1])));
  const drawnCos = Math.max(-1, Math.min(1, (u[0] * w[0] + u[1] * w[1]) / (norm(u) * norm(w))));
  return {
    P: toWorld(chart, frame, q, p),
    up: [uc, wc],
    dot,
    norms,
    cos,
    angle: Math.acos(cos),
    drawn: Math.acos(drawnCos),
  };
});
