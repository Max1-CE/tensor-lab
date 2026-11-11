// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Макс
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { IDENTITY_FRAME, makeChart, type Frame } from "../geometry/chart";
import { splitWrapped } from "../geometry/wrap";
import type { Analysis } from "../symbolic/types";
import { christoffelInfo, curvatureGrid, fanInfo, transportInfo } from "./compute2";

const dir = join(__dirname, "..", "..", "public", "precomputed");
const load = (id: string) => JSON.parse(readFileSync(join(dir, `${id}.json`), "utf8")) as Analysis;
const SKEW: Frame = { O: [0, 0], A: [1.1, 0.3, -0.2, 0.9] };

describe("Christoffel tool", () => {
  it.each(["polar", "elliptic", "parabolic"])("%s: Γ^k_ij e_k equals the measured change of the basis", (id) => {
    const chart = makeChart(load(id));
    for (const j of [0, 1] as const)
      for (const frame of [IDENTITY_FRAME, SKEW]) {
        const info = christoffelInfo(chart, frame, chart.defaults, chart.display.probe, j);
        info.predicted.forEach((v, i) => {
          expect(v[0]).toBeCloseTo(info.measured![i][0], 5);
          expect(v[1]).toBeCloseTo(info.measured![i][1], 5);
        });
      }
  });
});

describe("curvature grid", () => {
  it("sphere of radius 2 has R = 1/2 everywhere; the plane has R = 0", () => {
    const sphere = makeChart(load("sphere"));
    const g = curvatureGrid(sphere, { a: 2 }, 12, 10);
    g.R.forEach((r) => expect(r).toBeCloseTo(0.5, 10));
    const polar = makeChart(load("polar"));
    expect(curvatureGrid(polar, {}, 12, 10).maxAbs).toBeLessThan(1e-9);
  });

  it("torus: positive outside, negative inside, both signs present", () => {
    const torus = makeChart(load("torus"));
    const g = curvatureGrid(torus, torus.defaults, 8, 16);
    expect(Math.min(...g.R)).toBeLessThan(0);
    expect(Math.max(...g.R)).toBeGreaterThan(0);
  });
});

describe("transport tool", () => {
  it("sphere latitude loop: holonomy equals the cap curvature", () => {
    const sphere = makeChart(load("sphere"));
    const info = transportInfo(sphere, IDENTITY_FRAME, { a: 1 }, [0.7, 1], "line", 3, [0, 0.3]);
    expect(info.fluxNote).toBe("cap");
    const wrapped = Math.atan2(Math.sin(info.flux!), Math.cos(info.flux!));
    expect(info.angle).toBeCloseTo(wrapped, 5);
    expect(info.flux!).toBeCloseTo(2 * Math.PI * (1 - Math.cos(0.7)), 4);
  });

  it("torus tube loop bounds no disc", () => {
    const torus = makeChart(load("torus"));
    const info = transportInfo(torus, IDENTITY_FRAME, torus.defaults, [0.5, 0.5], "line", 3, [0.2, 0]);
    expect(info.fluxNote).toBe("none");
    expect(info.flux).toBeNull();
  });
});

describe("fan and wrapping", () => {
  it("fan rays stay inside the non-periodic domain", () => {
    const sphere = makeChart(load("sphere"));
    const info = fanInfo(sphere, IDENTITY_FRAME, { a: 1 }, [1, 1], 0, 0.5, Math.PI);
    for (const r of info.rays) for (const q of r.points) expect(q[0]).toBeGreaterThanOrEqual(0.06 - 1e-9);
  });

  it("splitWrapped breaks a curve where the periodic coordinate wraps", () => {
    const torus = makeChart(load("torus"));
    const parts = splitWrapped(torus, [
      [1, 6.0],
      [1, 6.2],
      [1, 6.4],
      [1, 6.6],
    ]);
    expect(parts).toHaveLength(2);
    expect(parts[1][0][1]).toBeCloseTo(6.4 - 2 * Math.PI, 12);
  });
});
