// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Макс
/** Tiny 2D linear algebra. Matrices are row-major [a, b, c, d] = [[a, b], [c, d]]. */

export type V2 = [number, number];
export type M2 = [number, number, number, number];

export const I2: M2 = [1, 0, 0, 1];

export const add = (u: V2, v: V2): V2 => [u[0] + v[0], u[1] + v[1]];
export const sub = (u: V2, v: V2): V2 => [u[0] - v[0], u[1] - v[1]];
export const scale = (u: V2, s: number): V2 => [u[0] * s, u[1] * s];
export const dot = (u: V2, v: V2): number => u[0] * v[0] + u[1] * v[1];
export const norm = (u: V2): number => Math.hypot(u[0], u[1]);
export const cross = (u: V2, v: V2): number => u[0] * v[1] - u[1] * v[0];

export const det = (m: M2): number => m[0] * m[3] - m[1] * m[2];
export const transpose = (m: M2): M2 => [m[0], m[2], m[1], m[3]];

export function mul(a: M2, b: M2): M2 {
  return [
    a[0] * b[0] + a[1] * b[2],
    a[0] * b[1] + a[1] * b[3],
    a[2] * b[0] + a[3] * b[2],
    a[2] * b[1] + a[3] * b[3],
  ];
}

export const mulV = (m: M2, v: V2): V2 => [m[0] * v[0] + m[1] * v[1], m[2] * v[0] + m[3] * v[1]];

export function inv(m: M2): M2 {
  const d = det(m);
  if (Math.abs(d) < 1e-14) throw new RangeError("singular matrix");
  return [m[3] / d, -m[1] / d, -m[2] / d, m[0] / d];
}

/** Matrix whose columns are u and v. */
export const fromCols = (u: V2, v: V2): M2 => [u[0], v[0], u[1], v[1]];
export const col = (m: M2, i: 0 | 1): V2 => (i === 0 ? [m[0], m[2]] : [m[1], m[3]]);

/** Gram matrix G_ij = c_i · c_j of the columns of m (i.e. mᵀ m). */
export const gram = (m: M2): M2 => mul(transpose(m), m);

/** Eigen-decomposition of a symmetric 2×2 matrix: values ascending, unit vectors. */
export function symEig(m: M2): { values: V2; vectors: [V2, V2] } {
  const [a, b, , d] = m;
  const tr = a + d;
  const disc = Math.sqrt(Math.max(0, ((a - d) / 2) ** 2 + b * b));
  const l1 = tr / 2 - disc;
  const l2 = tr / 2 + disc;
  let v1: V2;
  if (Math.abs(b) > 1e-14) v1 = [l1 - d, b];
  else v1 = a <= d ? [1, 0] : [0, 1];
  const n = norm(v1);
  v1 = [v1[0] / n, v1[1] / n];
  return { values: [l1, l2], vectors: [v1, [-v1[1], v1[0]]] };
}

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));
