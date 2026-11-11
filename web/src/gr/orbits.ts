// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Макс
/**
 * Timelike equatorial geodesics of Schwarzschild (G = c = 1, per unit mass).
 *
 *   (dr/dτ)² = E² − V(r),   V(r) = (1 − 2M/r)(1 + L²/r²),   dφ/dτ = L/r²
 *
 * With u = 1/r the orbit equation is
 *   (du/dφ)² = 2M u³ − u² + 2M u/L² + (E² − 1)/L² = 2M (u₁ − u)(u − u₂)(u₃ − u),
 *   d²u/dφ² + u = M/L² + 3M u²            (the 3Mu² term causes the precession),
 * where u₁ = 1/r_p, u₂ = 1/r_a and u₁ + u₂ + u₃ = 1/(2M).
 */
import { rk4 } from "../numeric/ode";

export interface Orbit {
  M: number;
  rp: number; // periapsis
  ra: number; // apoapsis
  u1: number;
  u2: number;
  u3: number;
  E: number; // energy per unit mass
  L: number; // angular momentum per unit mass
  /** p and e of the osculating ellipse: r = p / (1 + e cos φ). */
  p: number;
  e: number;
  valid: boolean; // a stable bound orbit with these turning points exists
}

export function orbitFromTurningPoints(M: number, rp: number, ra: number): Orbit {
  const u1 = 1 / rp;
  const u2 = 1 / ra;
  const u3 = 1 / (2 * M) - u1 - u2;
  const L2 = 1 / (u1 * u2 + u1 * u3 + u2 * u3);
  const E2 = 1 - 2 * M * L2 * u1 * u2 * u3;
  const p = (2 * rp * ra) / (rp + ra);
  const e = (ra - rp) / (ra + rp);
  const valid = u3 > u1 && L2 > 0 && E2 > 0 && E2 < 1;
  return { M, rp, ra, u1, u2, u3, E: Math.sqrt(Math.max(0, E2)), L: Math.sqrt(Math.max(0, L2)), p, e, valid };
}

/** Smallest periapsis for which a stable orbit with apoapsis ra exists: u₃ > u₁. */
export const minPeriapsis = (M: number, ra: number) => (4 * M * ra) / (ra - 2 * M);

export const effectivePotential = (r: number, L: number, M: number) => (1 - (2 * M) / r) * (1 + (L * L) / (r * r));

/** Complete elliptic integral of the first kind K(k) via the arithmetic–geometric mean. */
export function ellipticK(k: number): number {
  let a = 1;
  let b = Math.sqrt(1 - k * k);
  for (let i = 0; i < 40 && Math.abs(a - b) > 1e-15 * a; i++) {
    const an = (a + b) / 2;
    b = Math.sqrt(a * b);
    a = an;
  }
  return Math.PI / (2 * a);
}

/**
 * Perihelion advance per orbit (radians), exact:
 *   Δφ_orbit = 4 K(k) / √(2M(u₃ − u₂)),  k² = (u₁ − u₂)/(u₃ − u₂),   precession = Δφ_orbit − 2π.
 */
export function precessionExact(o: Orbit): number {
  const k = Math.sqrt((o.u1 - o.u2) / (o.u3 - o.u2));
  return (4 * ellipticK(k)) / Math.sqrt(2 * o.M * (o.u3 - o.u2)) - 2 * Math.PI;
}

/** Weak-field (Einstein 1915) approximation: 6πM / p. */
export const precessionWeak = (o: Orbit) => (6 * Math.PI * o.M) / o.p;

export interface Track {
  phi: Float64Array;
  r: Float64Array;
}

/** Integrate u(φ) with RK4 from apoapsis (u = u₂, u′ = 0) over `turns` revolutions. */
export function integrateOrbit(o: Orbit, turns: number, stepsPerTurn = 720): Track {
  const n = Math.round(turns * stepsPerTurn);
  const f = (_phi: number, y: Float64Array, out: Float64Array) => {
    out[0] = y[1];
    out[1] = (o.M / (o.L * o.L)) - y[0] + 3 * o.M * y[0] * y[0];
  };
  const ys = rk4(f, [o.u2, 0], 0, 2 * Math.PI * turns, n);
  const phi = new Float64Array(ys.length);
  const r = new Float64Array(ys.length);
  ys.forEach((y, i) => {
    phi[i] = (2 * Math.PI * turns * i) / n;
    r[i] = 1 / y[0];
  });
  return { phi, r };
}

/** Newtonian ellipse with the same p, e (apoapsis at φ = 0 like the track). */
export const newtonR = (o: Orbit, phi: number) => o.p / (1 - o.e * Math.cos(phi));

// ------------------------------------------------------------- Mercury
const ARCSEC = (180 / Math.PI) * 3600;
export const MERCURY = { a: 5.7909e7, e: 0.20563, periodDays: 87.969 }; // km, —, days

/** Mercury's perihelion advance in arcseconds per Julian century. */
export function mercuryArcsecPerCentury(sunKm: number): number {
  const rp = MERCURY.a * (1 - MERCURY.e);
  const ra = MERCURY.a * (1 + MERCURY.e);
  const o = orbitFromTurningPoints(sunKm, rp, ra);
  const perOrbit = precessionWeak(o); // the exact formula loses digits at M/p ~ 1e-8
  return perOrbit * ARCSEC * (36525 / MERCURY.periodDays);
}
