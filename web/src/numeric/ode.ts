// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Макс
/** ODE integrators: classic RK4 (fixed step) and Dormand–Prince RK5(4) (adaptive). */

export type Rhs = (t: number, y: Float64Array, out: Float64Array) => void;

/** One RK4 step of size h; writes the result into `out` (may alias y). */
export function rk4Step(f: Rhs, t: number, y: Float64Array, h: number, out: Float64Array): void {
  const n = y.length;
  const k1 = new Float64Array(n);
  const k2 = new Float64Array(n);
  const k3 = new Float64Array(n);
  const k4 = new Float64Array(n);
  const tmp = new Float64Array(n);
  f(t, y, k1);
  for (let i = 0; i < n; i++) tmp[i] = y[i] + (h / 2) * k1[i];
  f(t + h / 2, tmp, k2);
  for (let i = 0; i < n; i++) tmp[i] = y[i] + (h / 2) * k2[i];
  f(t + h / 2, tmp, k3);
  for (let i = 0; i < n; i++) tmp[i] = y[i] + h * k3[i];
  f(t + h, tmp, k4);
  for (let i = 0; i < n; i++) out[i] = y[i] + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
}

/** Integrate with `steps` RK4 steps on [t0, t1]; returns all states (steps + 1). */
export function rk4(f: Rhs, y0: ArrayLike<number>, t0: number, t1: number, steps: number): Float64Array[] {
  const h = (t1 - t0) / steps;
  const out: Float64Array[] = [Float64Array.from(y0)];
  for (let s = 0; s < steps; s++) {
    const next = new Float64Array(y0.length);
    rk4Step(f, t0 + s * h, out[s], h, next);
    if (!next.every(Number.isFinite)) break;
    out.push(next);
  }
  return out;
}

// Dormand–Prince 5(4) tableau
const C = [0, 1 / 5, 3 / 10, 4 / 5, 8 / 9, 1, 1];
const A = [
  [],
  [1 / 5],
  [3 / 40, 9 / 40],
  [44 / 45, -56 / 15, 32 / 9],
  [19372 / 6561, -25360 / 2187, 64448 / 6561, -212 / 729],
  [9017 / 3168, -355 / 33, 46732 / 5247, 49 / 176, -5103 / 18656],
  [35 / 384, 0, 500 / 1113, 125 / 192, -2187 / 6784, 11 / 84],
];
const B5 = [35 / 384, 0, 500 / 1113, 125 / 192, -2187 / 6784, 11 / 84, 0];
const B4 = [5179 / 57600, 0, 7571 / 16695, 393 / 640, -92097 / 339200, 187 / 2100, 1 / 40];

export interface Rk45Options {
  rtol?: number;
  atol?: number;
  h0?: number;
  hMax?: number;
  maxSteps?: number;
  /** Stop early when this returns true for an accepted state. */
  stop?: (t: number, y: Float64Array) => boolean;
}

export interface Rk45Result {
  t: number[];
  y: Float64Array[];
  ok: boolean; // reached t1 (or a stop condition) without failing
}

export function rk45(f: Rhs, y0: ArrayLike<number>, t0: number, t1: number, opts: Rk45Options = {}): Rk45Result {
  const { rtol = 1e-8, atol = 1e-10, hMax = Math.abs(t1 - t0), maxSteps = 20000 } = opts;
  const n = y0.length;
  const dir = Math.sign(t1 - t0) || 1;
  let h = dir * Math.min(opts.h0 ?? Math.abs(t1 - t0) / 100, hMax);
  let t = t0;
  let y = Float64Array.from(y0);
  const ts = [t];
  const ys = [y];
  const k = Array.from({ length: 7 }, () => new Float64Array(n));
  const tmp = new Float64Array(n);
  f(t, y, k[0]);
  for (let step = 0; step < maxSteps; step++) {
    if ((t1 - t) * dir <= 1e-15 * Math.max(1, Math.abs(t1))) return { t: ts, y: ys, ok: true };
    if ((t + h - t1) * dir > 0) h = t1 - t;
    for (let s = 1; s < 7; s++) {
      for (let i = 0; i < n; i++) {
        let acc = y[i];
        for (let j = 0; j < s; j++) acc += h * A[s][j] * k[j][i];
        tmp[i] = acc;
      }
      f(t + C[s] * h, tmp, k[s]);
    }
    const y5 = new Float64Array(n);
    let err = 0;
    for (let i = 0; i < n; i++) {
      let s5 = y[i];
      let s4 = y[i];
      for (let j = 0; j < 7; j++) {
        s5 += h * B5[j] * k[j][i];
        s4 += h * B4[j] * k[j][i];
      }
      y5[i] = s5;
      const sc = atol + rtol * Math.max(Math.abs(y[i]), Math.abs(s5));
      err = Math.max(err, Math.abs(s5 - s4) / sc);
    }
    if (!Number.isFinite(err)) return { t: ts, y: ys, ok: false };
    if (err <= 1) {
      t += h;
      y = y5;
      ts.push(t);
      ys.push(y);
      // FSAL: the last stage is f at the new point
      k[0].set(k[6]);
      if (opts.stop?.(t, y)) return { t: ts, y: ys, ok: true };
    }
    const factor = err === 0 ? 5 : Math.min(5, Math.max(0.2, 0.9 * err ** -0.2));
    h = dir * Math.min(hMax, Math.abs(h) * factor);
    if (Math.abs(h) < 1e-14) return { t: ts, y: ys, ok: false };
  }
  return { t: ts, y: ys, ok: false };
}
