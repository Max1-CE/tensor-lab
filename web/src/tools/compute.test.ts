// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Макс
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { IDENTITY_FRAME, makeChart, type Frame } from "../geometry/chart";
import { col, type V2 } from "../geometry/linalg";
import type { Analysis } from "../symbolic/types";
import { angleInfo, lengthInfo, metricInfo, vectorInfo } from "./compute";

const dir = join(__dirname, "..", "..", "public", "precomputed");
const load = (id: string) => JSON.parse(readFileSync(join(dir, `${id}.json`), "utf8")) as Analysis;
const SKEW: Frame = { O: [0, 0], A: [1.2, 0.6, 0.1, 0.9] };
const dot = (a: V2, b: V2) => a[0] * b[0] + a[1] * b[1];

describe("tool 1: metric", () => {
  const polar = makeChart(load("polar"));

  it("√g dx¹dx² approximates the cell area to first order", () => {
    const err = (f: number) => {
      const m = metricInfo(polar, IDENTITY_FRAME, {}, [2, 0.5], f, 0.5, 0.26);
      return Math.abs(m.cell.approx / m.cell.exact - 1);
    };
    expect(err(0.1)).toBeLessThan(err(0.5));
    expect(err(0.5) / err(0.1)).toBeGreaterThan(4); // ~linear convergence
    // analytic: approx/exact − 1 = −(dr/2) / (r + dr/2)
    const dr = 0.05 * 0.5;
    expect(err(0.05)).toBeCloseTo(dr / 2 / (2 + dr / 2), 10);
  });

  it("exact cell area matches the analytic polar area ½(r₂² − r₁²)Δφ", () => {
    const m = metricInfo(polar, IDENTITY_FRAME, {}, [2, 0.5], 1, 0.5, 0.26);
    expect(m.cell.exact).toBeCloseTo(0.5 * (2.5 ** 2 - 2 ** 2) * 0.26, 10);
    expect(m.sqrtG).toBeCloseTo(2, 8);
    m.delta.forEach((x, i) => expect(x).toBeCloseTo([1, 0, 0, 1][i], 10));
  });
});

describe("tool 3: co- and contravariant components", () => {
  it.each([IDENTITY_FRAME, SKEW])("v_i = v·e_i, e^i·e_j = δ^i_j, v^i v_i = |v|² (frame %#)", (frame) => {
    const chart = makeChart(load("elliptic"));
    const v: V2 = [0.7, -1.1];
    const info = vectorInfo(chart, frame, chart.defaults, chart.display.probe, v);
    const e = [col(info.E, 0), col(info.E, 1)];
    const d = [col(info.Edual, 0), col(info.Edual, 1)];
    expect(info.down[0]).toBeCloseTo(dot(v, e[0]), 10);
    expect(info.down[1]).toBeCloseTo(dot(v, e[1]), 10);
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) expect(dot(d[i], e[j])).toBeCloseTo(i === j ? 1 : 0, 10);
    expect(info.norm2).toBeCloseTo(dot(v, v), 10);
  });
});

describe("tool 4: angle", () => {
  it("embedded charts: the metric angle is the drawn angle, for any frame", () => {
    const chart = makeChart(load("parabolic"));
    const a = angleInfo(chart, SKEW, {}, chart.display.probe, [1, 0.2], [-0.3, 1]);
    expect(a.angle).toBeCloseTo(a.drawn, 10);
  });

  it("abstract charts: the metric angle differs from the drawn one", () => {
    const sphere = makeChart(load("sphere"));
    const a = angleInfo(sphere, IDENTITY_FRAME, { a: 1 }, [0.4, 1], [1, 0], [1, 1]);
    // g = diag(1, sin²θ): cosθ = 1 / √(1 + sin²0.4)
    expect(Math.cos(a.angle)).toBeCloseTo(1 / Math.sqrt(1 + Math.sin(0.4) ** 2), 10);
    expect(a.drawn).toBeCloseTo(Math.PI / 4, 12);
  });
});

describe("tool 2: length", () => {
  it("periodic coordinates: the geodesic takes the short way round", () => {
    const polar = makeChart(load("polar"));
    const info = lengthInfo(polar, IDENTITY_FRAME, {}, [2, 0.2], [2, 6.0]);
    expect(info.target[1]).toBeCloseTo(6.0 - 2 * Math.PI, 12);
    expect(info.geo).not.toBeNull();
    expect(info.geo!.length).toBeCloseTo(info.chord!, 6);
    expect(info.coord).toBeGreaterThan(info.geo!.length); // the arc goes the long way
  });
});
