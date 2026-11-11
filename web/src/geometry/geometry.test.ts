// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Макс
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Analysis } from "../symbolic/types";
import { compileBody } from "../symbolic/compile";
import {
  IDENTITY_FRAME,
  clampToDomain,
  fromWorld,
  frameWithLocalBasis,
  localBasis,
  makeChart,
  metricAt,
  toWorld,
  type Frame,
} from "./chart";
import { axisValues, morphFamily, sampleGrid, SAMPLES } from "./grid";
import { det, fromCols, gram, inv, mul, symEig, type M2, type V2 } from "./linalg";
import { fitBox, toScreen, toWorldPt, zoomAt, type Viewport } from "./viewport";

const dir = join(__dirname, "..", "..", "public", "precomputed");
const load = (id: string) => JSON.parse(readFileSync(join(dir, `${id}.json`), "utf8")) as Analysis;
const PLANE = ["cartesian", "skew", "polar", "elliptic", "parabolic"];

const close = (a: number[], b: number[], eps = 1e-6) =>
  a.forEach((x, i) => expect(x).toBeCloseTo(b[i], -Math.log10(eps)));

describe("linalg", () => {
  it("inverts and multiplies", () => {
    const m: M2 = [2, 1, -1, 3];
    close(mul(m, inv(m)), [1, 0, 0, 1], 1e-12);
    expect(det(m)).toBe(7);
    expect(() => inv([1, 2, 2, 4])).toThrow();
  });

  it("symmetric eigen-decomposition reconstructs the matrix", () => {
    const m: M2 = [3, 1.2, 1.2, 0.5];
    const { values, vectors } = symEig(m);
    const [u, v] = vectors;
    const rec = [0, 1, 2, 3].map((k) => {
      const [i, j] = [k >> 1, k & 1];
      return values[0] * u[i] * u[j] + values[1] * v[i] * v[j];
    });
    close(rec, m, 1e-10);
    expect(values[0]).toBeLessThan(values[1]);
  });
});

describe("compiled preset metrics", () => {
  it.each(PLANE)("%s: numeric JᵀJ of the embedding equals the symbolic g_ij", (id) => {
    const chart = makeChart(load(id));
    expect(chart.kind).toBe("embedded");
    for (const q of [[1.1, 0.7], [0.4, 2.9], [2.2, 1.3]] as V2[]) {
      const numeric = metricAt(chart, IDENTITY_FRAME, q, chart.defaults);
      close(numeric, chart.metricFn(q, chart.defaults), 1e-5);
    }
  });

  it("polar: e_r is a unit vector, |e_φ| = r", () => {
    const chart = makeChart(load("polar"));
    const E = localBasis(chart, IDENTITY_FRAME, [2.5, 0.3], {});
    expect(Math.hypot(E[0], E[2])).toBeCloseTo(1, 6);
    expect(Math.hypot(E[1], E[3])).toBeCloseTo(2.5, 6);
  });

  it("sphere JSON compiles to an abstract chart with R = 2/a²", () => {
    const a = load("sphere");
    const chart = makeChart(a);
    expect(chart.kind).toBe("abstract");
    expect(compileBody(a.js.scalar)([1, 0], { a: 2 })[0]).toBeCloseTo(0.5, 12);
  });
});

describe("frame dragging", () => {
  it.each(PLANE)("%s: the dragged local basis becomes the basis and g = EᵀE", (id) => {
    const chart = makeChart(load(id));
    const q = chart.display.probe;
    const E: M2 = fromCols([1.3, 0.4], [-0.2, 0.9]);
    const before = toWorld(chart, IDENTITY_FRAME, q, chart.defaults);
    const f = frameWithLocalBasis(chart, IDENTITY_FRAME, q, chart.defaults, E);
    close(localBasis(chart, f, q, chart.defaults), E, 1e-6);
    close(metricAt(chart, f, q, chart.defaults), gram(E), 1e-6);
    close(toWorld(chart, f, q, chart.defaults), before, 1e-9); // probe stays put
  });

  it("cartesian with a skewed frame reproduces the skew metric", () => {
    const chart = makeChart(load("cartesian"));
    const alpha = Math.PI / 3;
    const f: Frame = { O: [0, 0], A: fromCols([1, 0], [Math.cos(alpha), Math.sin(alpha)]) };
    const skew = makeChart(load("skew"));
    close(metricAt(chart, f, [0.3, -1], {}), skew.metricFn([0, 0], { alpha }), 1e-8);
  });
});

describe("inverse map", () => {
  it.each(PLANE)("%s: fromWorld(toWorld(q)) = q", (id) => {
    const chart = makeChart(load(id));
    const f: Frame = { O: [0.5, -0.25], A: [1.1, 0.2, -0.1, 0.9] };
    const q = chart.display.probe;
    const w = toWorld(chart, f, q, chart.defaults);
    const guess: V2 = [q[0] * 0.8 + 0.1, q[1] * 1.1];
    close(fromWorld(chart, f, w, guess, chart.defaults), q, 1e-6);
  });

  it("periodic coordinates wrap and radial ones are clamped", () => {
    const chart = makeChart(load("polar"));
    const [r, phi] = clampToDomain(chart, [-1, 7]);
    expect(r).toBe(0.05);
    expect(phi).toBeCloseTo(7 - 2 * Math.PI, 12);
  });
});

describe("grid", () => {
  it("samples every coordinate line; periodic axes skip the duplicate end", () => {
    const chart = makeChart(load("polar"));
    const g = sampleGrid(chart, IDENTITY_FRAME, {});
    expect(g.families[0]).toHaveLength(21);
    expect(g.families[1]).toHaveLength(24);
    expect(axisValues(chart, 1).at(-1)).toBeLessThan(2 * Math.PI);
    expect(g.families[0][4]).toHaveLength(2 * SAMPLES);
    // the r = 2 circle has radius 2 everywhere
    const circle = g.families[0][4];
    for (let s = 0; s < SAMPLES; s += 17) expect(Math.hypot(circle[2 * s], circle[2 * s + 1])).toBeCloseTo(2, 9);
  });

  it("morph has the endpoints as limits and handles different counts", () => {
    const a = [new Float64Array([0, 0, 1, 1])];
    const b = [new Float64Array([2, 2, 3, 3]), new Float64Array([4, 4, 5, 5])];
    expect(morphFamily(a, b, 0).map((l) => [...l])).toEqual([[0, 0, 1, 1], [0, 0, 1, 1]]);
    expect(morphFamily(a, b, 1).map((l) => [...l])).toEqual([[2, 2, 3, 3], [4, 4, 5, 5]]);
    expect([...morphFamily(a, b, 0.5)[1]]).toEqual([2, 2, 3, 3]);
  });
});

describe("viewport", () => {
  const v: Viewport = { width: 800, height: 600, pan: [10, -20], scale: 80 };
  it("round-trips", () => {
    close(toWorldPt(v, toScreen(v, [1.5, -2])), [1.5, -2], 1e-12);
  });
  it("fitBox centres the box in the free area", () => {
    const f = fitBox(v, [0, 4, 0, 2], { left: 200, right: 0, top: 0, bottom: 0 }, 1);
    expect(f.scale).toBeCloseTo(150, 9); // min(600/4, 600/2)
    close(toScreen(f, [2, 1]), [500, 300], 1e-9);
  });

  it("zoom keeps the point under the cursor fixed", () => {
    const at: V2 = [123, 456];
    const w = toWorldPt(v, at);
    const z = zoomAt(v, at, 1.7);
    close(toScreen(z, w), at, 1e-9);
    expect(z.scale).toBeCloseTo(136, 9);
  });
});
