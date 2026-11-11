// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Макс
/** Curve lengths and geodesics (initial value problem + shooting for the BVP). */
import { inv, type V2 } from "../geometry/linalg";
import { inner, type MetricField } from "./field";
import { rk4, rk45, type Rk45Options } from "./ode";

// 5-point Gauss–Legendre nodes/weights on [-1, 1]
const GL_X = [0, -0.5384693101056831, 0.5384693101056831, -0.906179845938664, 0.906179845938664];
const GL_W = [0.5688888888888889, 0.47862867049936647, 0.47862867049936647, 0.23692688505618908, 0.23692688505618908];

/** ∫ f on [a, b] with composite 5-point Gauss–Legendre. */
export function integrate(f: (t: number) => number, a: number, b: number, panels = 64): number {
  const h = (b - a) / panels;
  let s = 0;
  for (let p = 0; p < panels; p++) {
    const mid = a + (p + 0.5) * h;
    for (let k = 0; k < 5; k++) s += GL_W[k] * f(mid + (h / 2) * GL_X[k]);
  }
  return (s * h) / 2;
}

/** L = ∫ √(g_ij ẋ^i ẋ^j) dt for a curve given by x(t) and ẋ(t) on [0, 1]. */
export function curveLength(field: MetricField, x: (t: number) => V2, dx: (t: number) => V2, panels = 64): number {
  return integrate((t) => {
    const v = dx(t);
    return Math.sqrt(Math.max(0, inner(field.g(x(t)), v, v)));
  }, 0, 1, panels);
}

/** Length of the coordinate-straight segment x(t) = A + t(B − A). */
export function coordinateSegmentLength(field: MetricField, A: V2, B: V2): number {
  const d: V2 = [B[0] - A[0], B[1] - A[1]];
  return curveLength(field, (t) => [A[0] + t * d[0], A[1] + t * d[1]], () => d);
}

/** Geodesic equation as a first-order system y = [x¹, x², v¹, v²]. */
export function geodesicRhs(field: MetricField) {
  return (_t: number, y: Float64Array, out: Float64Array) => {
    const G = field.christoffel([y[0], y[1]]);
    const v0 = y[2];
    const v1 = y[3];
    out[0] = v0;
    out[1] = v1;
    out[2] = -(G[0] * v0 * v0 + (G[1] + G[2]) * v0 * v1 + G[3] * v1 * v1);
    out[3] = -(G[4] * v0 * v0 + (G[5] + G[6]) * v0 * v1 + G[7] * v1 * v1);
  };
}

export interface GeodesicPath {
  points: V2[];
  velocities: V2[];
  length: number;
}

function pathFromStates(field: MetricField, ys: Float64Array[], dt: number): GeodesicPath {
  const points = ys.map((y) => [y[0], y[1]] as V2);
  const velocities = ys.map((y) => [y[2], y[3]] as V2);
  const speed = ys.map((_y, i) => Math.sqrt(Math.max(0, inner(field.g(points[i]), velocities[i], velocities[i]))));
  // Simpson (falls back to trapezoid on an odd interval count)
  let length = 0;
  const n = speed.length - 1;
  if (n >= 2 && n % 2 === 0) {
    for (let i = 0; i < n; i += 2) length += (dt / 3) * (speed[i] + 4 * speed[i + 1] + speed[i + 2]);
  } else {
    for (let i = 0; i < n; i++) length += (dt / 2) * (speed[i] + speed[i + 1]);
  }
  return { points, velocities, length };
}

/** Geodesic from x0 with initial velocity v0 over t ∈ [0, 1], fixed-step RK4. */
export function shoot(field: MetricField, x0: V2, v0: V2, steps = 256): GeodesicPath {
  const ys = rk4(geodesicRhs(field), [x0[0], x0[1], v0[0], v0[1]], 0, 1, steps);
  return pathFromStates(field, ys, 1 / steps);
}

/** Adaptive geodesic (Dormand–Prince) — for long rays such as geodesic fans. */
export function geodesicAdaptive(
  field: MetricField,
  x0: V2,
  v0: V2,
  tMax: number,
  opts: Rk45Options = {},
): { points: V2[]; ok: boolean } {
  const r = rk45(geodesicRhs(field), [x0[0], x0[1], v0[0], v0[1]], 0, tMax, opts);
  return { points: r.y.map((y) => [y[0], y[1]] as V2), ok: r.ok };
}

export interface BvpResult extends GeodesicPath {
  v0: V2;
  converged: boolean;
  iterations: number;
  miss: number; // final |x(1) − B| in coordinates
}

/**
 * Geodesic boundary value problem by the shooting method:
 * find v0 with x(1; v0) = B using damped Newton, Jacobian by finite differences.
 */
export function shootTo(field: MetricField, A: V2, B: V2, opts: { steps?: number; guess?: V2; tol?: number } = {}): BvpResult {
  const steps = opts.steps ?? 200;
  const tol = opts.tol ?? 1e-9;
  let v: V2 = opts.guess ?? [B[0] - A[0], B[1] - A[1]];
  const end = (vv: V2): V2 | null => {
    const p = shoot(field, A, vv, steps).points;
    if (p.length !== steps + 1) return null; // blew up (hit a singularity)
    return p[steps];
  };
  const resid = (vv: V2): V2 | null => {
    const e = end(vv);
    return e ? [e[0] - B[0], e[1] - B[1]] : null;
  };
  let F = resid(v);
  let it = 0;
  for (; F && it < 40; it++) {
    const nF = Math.hypot(F[0], F[1]);
    if (nF < tol) break;
    const h = 1e-6 * Math.max(1, Math.hypot(v[0], v[1]));
    const cols: V2[] = [];
    for (let k = 0; k < 2; k++) {
      const vp: V2 = [...v];
      vp[k] += h;
      const Fp = resid(vp);
      if (!Fp) break;
      cols.push([(Fp[0] - F[0]) / h, (Fp[1] - F[1]) / h]);
    }
    if (cols.length < 2) break;
    let J;
    try {
      J = inv([cols[0][0], cols[1][0], cols[0][1], cols[1][1]]);
    } catch {
      break;
    }
    const d: V2 = [J[0] * F[0] + J[1] * F[1], J[2] * F[0] + J[3] * F[1]];
    // damped step: halve until the residual decreases
    let lam = 1;
    let accepted = false;
    for (let k = 0; k < 12; k++, lam /= 2) {
      const cand: V2 = [v[0] - lam * d[0], v[1] - lam * d[1]];
      const Fc = resid(cand);
      if (Fc && Math.hypot(Fc[0], Fc[1]) < nF) {
        v = cand;
        F = Fc;
        accepted = true;
        break;
      }
    }
    if (!accepted) break;
  }
  const path = shoot(field, A, v, steps);
  const miss = F ? Math.hypot(F[0], F[1]) : Infinity;
  return { ...path, v0: v, converged: miss < 1e-6, iterations: it, miss };
}
