// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Макс
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { integrate } from "../numeric/curves";
import { compileAnalysis } from "../symbolic/compile";
import type { Analysis } from "../symbolic/types";
import { flammZ, localQuantities, properDistance, SCHWARZSCHILD } from "./spacetime";

const json = JSON.parse(
  readFileSync(join(__dirname, "..", "..", "public", "precomputed", "schwarzschild.json"), "utf8"),
) as Analysis;

describe("Schwarzschild", () => {
  it("the compiled symbolic metric agrees with the page's formulas", () => {
    const c = compileAnalysis(json);
    const M = 1.7;
    const r = 9.3;
    const g = c.metric([0, r, 1.1, 0.4], { M });
    const q = localQuantities(r, M);
    expect(g[0]).toBeCloseTo(q.gtt, 12); // g_tt
    expect(g[5]).toBeCloseTo(q.grr, 12); // g_rr
    expect(c.scalar([0, r, 1.1, 0.4], { M })[0]).toBeCloseTo(0, 12); // vacuum
  });

  it("Flamm's paraboloid: the embedded slope reproduces g_rr", () => {
    const M = 1.3;
    for (const r of [2.7, 4, 10, 30]) {
      const h = 1e-6;
      const dz = (flammZ(r + h, M) - flammZ(r - h, M)) / (2 * h);
      expect(1 + dz * dz).toBeCloseTo(localQuantities(r, M).grr, 6);
    }
    expect(flammZ(2 * M, M)).toBe(0);
  });

  it("proper radial distance: closed form equals ∫ dr/√(1 − 2M/r) and exceeds Δr", () => {
    const M = 1;
    const r1 = 3;
    const r2 = 12;
    const numeric = integrate((r) => 1 / Math.sqrt(1 - (2 * M) / r), r1, r2, 400);
    expect(properDistance(r1, r2, M)).toBeCloseTo(numeric, 8);
    expect(properDistance(r1, r2, M)).toBeGreaterThan(r2 - r1);
    // far away the space is almost flat
    expect(properDistance(1000, 1001, M) - 1).toBeLessThan(0.002);
  });

  it("characteristic radii and local quantities", () => {
    const M = 2;
    expect(SCHWARZSCHILD.radii.map((x) => x.r(M))).toEqual([4, 6, 12]);
    expect(localQuantities(3 * M + 1e-12, M).orbitSpeed).toBeCloseTo(1, 6); // light at the photon sphere
    expect(localQuantities(6 * M, M).stable).toBe(true);
    expect(localQuantities(5 * M, M).stable).toBe(false);
    expect(localQuantities(2 * M * 1.0000001, M).dilation).toBeLessThan(1e-3);
    expect(localQuantities(4, 1).kretschmann).toBeCloseTo(48 / 4 ** 6, 15);
  });
});
