// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Макс
/**
 * Spacetimes for the GR page (units G = c = 1, signature −+++).
 *
 * A `Spacetime` describes everything the page needs to draw an equatorial
 * embedding diagram and its characteristic radii. Schwarzschild is the first
 * implementation; Kerr, orbits and light bending plug in through the same
 * interface and the module list in ./modules.ts.
 */

/** Mass of the Sun in geometric units (GM☉/c²), km. */
export const SUN_KM = 1.476625;

export interface CharacteristicRadius {
  id: string;
  /** Radius as a function of the mass. */
  r: (M: number) => number;
  /** In units of M, e.g. "2M" (for labels). */
  label: string;
  color: string;
}

export interface Spacetime {
  id: string;
  title: string;
  /** Embedding height z(r) of the equatorial slice t = const, θ = π/2 (Flamm for Schwarzschild). */
  embeddingZ(r: number, M: number): number;
  /** Smallest r of the exterior region (the horizon). */
  rMin(M: number): number;
  radii: CharacteristicRadius[];
}

// ------------------------------------------------------------ Schwarzschild
export const f = (r: number, M: number) => 1 - (2 * M) / r;

/** Flamm's paraboloid: z = 2√(2M(r − 2M)), from dz² + dr² = dr²/(1 − 2M/r). */
export const flammZ = (r: number, M: number) => 2 * Math.sqrt(Math.max(0, 2 * M * (r - 2 * M)));

/**
 * Proper radial distance between r₁ and r₂ (both ≥ 2M) on the slice t = const:
 *   s = ∫ dr / √(1 − 2M/r).
 * With r = 2M + u² the integrand becomes 2√(2M + u²), whose antiderivative is
 *   u√(u² + 2M) + 2M ln(u + √(u² + 2M)).
 */
export function properDistance(r1: number, r2: number, M: number): number {
  const F = (r: number) => {
    const u = Math.sqrt(Math.max(0, r - 2 * M));
    const w = Math.sqrt(u * u + 2 * M);
    return u * w + 2 * M * Math.log(u + w);
  };
  return F(r2) - F(r1);
}

export interface LocalQuantities {
  f: number; // 1 − 2M/r
  gtt: number; // −f
  grr: number; // 1/f
  dilation: number; // dτ/dt = √f for a static observer
  escape: number; // escape speed √(2M/r) measured by a static observer
  /** Speed of a circular orbit measured by a static observer (r > 3M), else null. */
  orbitSpeed: number | null;
  stable: boolean; // circular orbit is stable (r ≥ 6M)
  kretschmann: number; // 48 M² / r⁶
}

export function localQuantities(r: number, M: number): LocalQuantities {
  const ff = f(r, M);
  return {
    f: ff,
    gtt: -ff,
    grr: 1 / ff,
    dilation: Math.sqrt(Math.max(0, ff)),
    escape: Math.sqrt((2 * M) / r),
    orbitSpeed: r > 3 * M ? Math.sqrt(M / (r - 2 * M)) : null,
    stable: r >= 6 * M,
    kretschmann: (48 * M * M) / r ** 6,
  };
}

export const SCHWARZSCHILD: Spacetime = {
  id: "schwarzschild",
  title: "Шварцшильд",
  embeddingZ: flammZ,
  rMin: (M) => 2 * M,
  radii: [
    { id: "horizon", r: (M) => 2 * M, label: "2M", color: "#ff5c5c" },
    { id: "photon", r: (M) => 3 * M, label: "3M", color: "#ffc857" },
    { id: "isco", r: (M) => 6 * M, label: "6M", color: "#7dff8a" },
  ],
};
