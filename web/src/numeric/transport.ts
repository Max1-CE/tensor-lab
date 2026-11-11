// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Макс
/** Parallel transport, holonomy, enclosed curvature and geodesic fans (2D charts). */
import { det, type M2, type V2 } from "../geometry/linalg";
import { integrate } from "./curves";
import { geodesicRhs } from "./curves";
import { inner, type MetricField } from "./field";
import { rk4, rk4Step } from "./ode";

export interface TransportStep {
  t: number;
  q: V2;
  v: V2; // contravariant components
}

/**
 * Parallel transport of v along q(t), t ∈ [0, 1]:
 *   dv^λ/dt = −Γ^λ_{μν} q̇^μ v^ν   (RK4 with the curve known analytically).
 */
export function parallelTransport(
  field: MetricField,
  q: (t: number) => V2,
  dq: (t: number) => V2,
  v0: V2,
  steps = 400,
): TransportStep[] {
  const f = (t: number, v: Float64Array, out: Float64Array) => {
    const G = field.christoffel(q(t));
    const x = dq(t);
    for (let l = 0; l < 2; l++) {
      let s = 0;
      for (let m = 0; m < 2; m++) for (let n = 0; n < 2; n++) s += G[4 * l + 2 * m + n] * x[m] * v[n];
      out[l] = -s;
    }
  };
  const out: TransportStep[] = [{ t: 0, q: q(0), v: [...v0] }];
  let v = Float64Array.from(v0);
  const h = 1 / steps;
  for (let s = 0; s < steps; s++) {
    const next = new Float64Array(2);
    rk4Step(f, s * h, v, h, next);
    v = next;
    const t = (s + 1) * h;
    out.push({ t, q: q(t), v: [v[0], v[1]] });
  }
  return out;
}

/** Oriented angle from a to b in the metric g (positive in the coordinate orientation). */
export function orientedAngle(g: M2, a: V2, b: V2): number {
  const sqrtG = Math.sqrt(Math.abs(det(g)));
  const c = inner(g, a, b);
  const s = sqrtG * (a[0] * b[1] - a[1] * b[0]); // ε_ij a^i b^j
  return Math.atan2(s, c);
}

/** ∬ K √g dq¹dq² over the coordinate ellipse C + s(ρ₀cos θ, ρ₁ sin θ), s ≤ 1. */
export function curvatureInEllipse(K: (q: V2) => number, sqrtG: (q: V2) => number, C: V2, rho: V2): number {
  return integrate(
    (s) =>
      integrate((th) => {
        const q: V2 = [C[0] + s * rho[0] * Math.cos(th), C[1] + s * rho[1] * Math.sin(th)];
        return K(q) * sqrtG(q);
      }, 0, 2 * Math.PI, 16) *
      rho[0] *
      rho[1] *
      s,
    0,
    1,
    12,
  );
}

/** ∬ K √g over the strip q¹ ∈ [a, b], q² over one full period [lo, hi]. */
export function curvatureInStrip(K: (q: V2) => number, sqrtG: (q: V2) => number, a: number, b: number, lo: number, hi: number): number {
  return integrate((x) => integrate((y) => K([x, y]) * sqrtG([x, y]), lo, hi, 16), a, b, 24);
}

/** Wrap an angle into (−π, π]. */
export const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Orthonormal frame at q (Gram–Schmidt on ∂₁, ∂₂ in the metric g), contravariant. */
export function orthonormalFrame(g: M2): [V2, V2] {
  const n1 = Math.sqrt(g[0]);
  const f1: V2 = [1 / n1, 0];
  // ∂₂ minus its projection on f1
  const proj = inner(g, [0, 1], f1);
  const w: V2 = [-proj * f1[0], 1 - proj * f1[1]];
  const n2 = Math.sqrt(inner(g, w, w));
  return [f1, [w[0] / n2, w[1] / n2]];
}

export interface Ray {
  points: V2[];
  /** Arc length of each sample (unit speed, so equal to t). */
  s: number[];
}

/** Unit-speed geodesics from P at angles α ∈ [α₀ − σ, α₀ + σ] (fixed-step RK4). */
export function geodesicFan(
  field: MetricField,
  P: V2,
  alpha0: number,
  spread: number,
  count: number,
  length: number,
  inside: (q: V2) => boolean,
  steps = 360,
): Ray[] {
  const [f1, f2] = orthonormalFrame(field.g(P));
  const rays: Ray[] = [];
  for (let k = 0; k < count; k++) {
    const a = count === 1 ? alpha0 : alpha0 - spread + (2 * spread * k) / (count - 1);
    const v: V2 = [Math.cos(a) * f1[0] + Math.sin(a) * f2[0], Math.cos(a) * f1[1] + Math.sin(a) * f2[1]];
    const ys = rk4(geodesicRhs(field), [P[0], P[1], v[0], v[1]], 0, length, steps);
    const points: V2[] = [];
    const s: number[] = [];
    for (let i = 0; i < ys.length; i++) {
      const q: V2 = [ys[i][0], ys[i][1]];
      if (!inside(q)) break;
      points.push(q);
      s.push((i * length) / steps);
    }
    rays.push({ points, s });
  }
  return rays;
}

/** Metric distance between two neighbouring rays at equal arc length (short-distance approx.). */
export function raySeparation(field: MetricField, a: Ray, b: Ray): { s: number; d: number }[] {
  const n = Math.min(a.points.length, b.points.length);
  const out: { s: number; d: number }[] = [];
  for (let i = 0; i < n; i++) {
    const p = a.points[i];
    const q = b.points[i];
    const mid: V2 = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    const d: V2 = [q[0] - p[0], q[1] - p[1]];
    out.push({ s: a.s[i], d: Math.sqrt(Math.max(0, inner(field.g(mid), d, d))) });
  }
  return out;
}
