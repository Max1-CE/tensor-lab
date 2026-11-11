// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Макс
import { describe, expect, it } from "vitest";
import {
  effectivePotential,
  ellipticK,
  integrateOrbit,
  mercuryArcsecPerCentury,
  minPeriapsis,
  orbitFromTurningPoints,
  precessionExact,
  precessionWeak,
} from "./orbits";
import { SUN_KM } from "./spacetime";

describe("orbits from turning points", () => {
  it("E² equals the effective potential at both turning points", () => {
    const o = orbitFromTurningPoints(1, 10, 25);
    expect(o.valid).toBe(true);
    expect(effectivePotential(10, o.L, 1)).toBeCloseTo(o.E * o.E, 12);
    expect(effectivePotential(25, o.L, 1)).toBeCloseTo(o.E * o.E, 12);
  });

  it("circular limit: L² = M r² / (r − 3M)", () => {
    const r = 12;
    const o = orbitFromTurningPoints(1, r * (1 - 1e-7), r * (1 + 1e-7));
    expect(o.L * o.L).toBeCloseTo((r * r) / (r - 3), 5);
  });

  it("stability boundary: u₃ = u₁ at the minimum periapsis; ISCO for circular orbits", () => {
    const ra = 20;
    const rpMin = minPeriapsis(1, ra);
    const o = orbitFromTurningPoints(1, rpMin, ra);
    expect(o.u3).toBeCloseTo(o.u1, 12);
    expect(orbitFromTurningPoints(1, rpMin * 0.99, ra).valid).toBe(false);
    // circular orbits are stable only for r > 6M
    expect(orbitFromTurningPoints(1, 6.2, 6.2 + 1e-6).valid).toBe(true);
    expect(orbitFromTurningPoints(1, 5.8, 5.8 + 1e-6).valid).toBe(false);
  });
});

describe("perihelion precession", () => {
  it("K(0) = π/2 and K(1/√2) = 1.8540746773", () => {
    expect(ellipticK(0)).toBeCloseTo(Math.PI / 2, 14);
    expect(ellipticK(Math.SQRT1_2)).toBeCloseTo(1.8540746773013719, 12);
  });

  it("the exact formula matches direct RK4 integration of u(φ)", () => {
    const o = orbitFromTurningPoints(1, 9, 20);
    const t = integrateOrbit(o, 3, 4000);
    // successive apoapses = local maxima of r
    const peaks: number[] = [];
    for (let i = 1; i < t.r.length - 1; i++) if (t.r[i] > t.r[i - 1] && t.r[i] >= t.r[i + 1]) peaks.push(i);
    // parabolic refinement of the second apoapsis
    const i = peaks[0];
    const [a, b, c] = [t.r[i - 1], t.r[i], t.r[i + 1]];
    const h = t.phi[1] - t.phi[0];
    const phiPeak = t.phi[i] + (h * (a - c)) / (2 * (a - 2 * b + c));
    expect(phiPeak - 2 * Math.PI).toBeCloseTo(precessionExact(o), 5);
  });

  it("approaches 6πM/p in the weak field", () => {
    const o = orbitFromTurningPoints(1, 2000, 3000);
    expect(precessionExact(o) / precessionWeak(o)).toBeCloseTo(1, 2);
    const strong = orbitFromTurningPoints(1, 9, 20);
    expect(precessionExact(strong)).toBeGreaterThan(precessionWeak(strong));
  });

  it("Mercury: ≈ 43″ per century", () => {
    expect(mercuryArcsecPerCentury(SUN_KM)).toBeCloseTo(42.98, 1);
  });
});
