// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Макс
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { IDENTITY_FRAME, makeChart, metricAt } from "../geometry/chart";
import { det, type V2 } from "../geometry/linalg";
import { compileAnalysis } from "../symbolic/compile";
import type { Analysis } from "../symbolic/types";
import { fieldFor, inner } from "./field";
import {
  curvatureInEllipse,
  curvatureInStrip,
  geodesicFan,
  orientedAngle,
  orthonormalFrame,
  parallelTransport,
  raySeparation,
  wrapAngle,
} from "./transport";

const dir = join(__dirname, "..", "..", "public", "precomputed");
const load = (id: string) => JSON.parse(readFileSync(join(dir, `${id}.json`), "utf8")) as Analysis;
const TAU = 2 * Math.PI;

function setup(id: string, p: Record<string, number>) {
  const chart = makeChart(load(id));
  const field = fieldFor(chart, IDENTITY_FRAME, p);
  const scalar = compileAnalysis(chart.analysis).scalar;
  const K = (q: V2) => scalar(q, p)[0] / 2;
  const sqrtG = (q: V2) => Math.sqrt(Math.abs(det(metricAt(chart, IDENTITY_FRAME, q, p))));
  return { chart, field, K, sqrtG };
}

describe("parallel transport", () => {
  it("sphere, latitude θ₀: holonomy = 2π(1 − cos θ₀) = ∬K dA of the polar cap", () => {
    const { field, K, sqrtG } = setup("sphere", { a: 1 });
    const th0 = 0.9;
    const steps = parallelTransport(field, (t) => [th0, TAU * t], () => [0, TAU], [0.3, 0], 800);
    const v1 = steps.at(-1)!.v;
    const g = field.g([th0, 0]);
    const angle = orientedAngle(g, [0.3, 0], v1);
    const expected = wrapAngle(TAU * (1 - Math.cos(th0)));
    expect(angle).toBeCloseTo(expected, 6);
    expect(wrapAngle(curvatureInStrip(K, sqrtG, 0, th0, 0, TAU))).toBeCloseTo(expected, 6);
    // length is preserved
    expect(inner(field.g(steps.at(-1)!.q), v1, v1)).toBeCloseTo(inner(g, [0.3, 0], [0.3, 0]), 8);
  });

  it("sphere, small coordinate circle: rotation = ∬K dA (Gauss–Bonnet), sign included", () => {
    const { field, K, sqrtG } = setup("sphere", { a: 2 });
    const C: V2 = [1.2, 0.5];
    const rho: V2 = [0.3, 0.4];
    const q = (t: number): V2 => [C[0] + rho[0] * Math.cos(TAU * t), C[1] + rho[1] * Math.sin(TAU * t)];
    const dq = (t: number): V2 => [-TAU * rho[0] * Math.sin(TAU * t), TAU * rho[1] * Math.cos(TAU * t)];
    const st = parallelTransport(field, q, dq, [0, 0.2], 800);
    const angle = orientedAngle(field.g(q(0)), [0, 0.2], st.at(-1)!.v);
    const flux = curvatureInEllipse(K, sqrtG, C, rho);
    expect(flux).toBeGreaterThan(0);
    expect(angle).toBeCloseTo(flux, 6);
  });

  it("polar plane: Γ ≠ 0 but a loop around the origin brings the vector back", () => {
    const { field } = setup("polar", {});
    const st = parallelTransport(field, (t) => [2, TAU * t], () => [0, TAU], [0.4, 0.1], 400);
    const v1 = st.at(-1)!.v;
    expect(v1[0]).toBeCloseTo(0.4, 8);
    expect(v1[1]).toBeCloseTo(0.1, 8);
  });

  it("saddle: negative curvature turns the vector the other way", () => {
    const { field, K, sqrtG } = setup("saddle", { k: 1 });
    const C: V2 = [0.2, -0.1];
    const rho: V2 = [0.5, 0.5];
    const q = (t: number): V2 => [C[0] + rho[0] * Math.cos(TAU * t), C[1] + rho[1] * Math.sin(TAU * t)];
    const dq = (t: number): V2 => [-TAU * rho[0] * Math.sin(TAU * t), TAU * rho[1] * Math.cos(TAU * t)];
    const st = parallelTransport(field, q, dq, [0.3, 0], 800);
    const angle = orientedAngle(field.g(q(0)), [0.3, 0], st.at(-1)!.v);
    expect(angle).toBeLessThan(0);
    expect(angle).toBeCloseTo(curvatureInEllipse(K, sqrtG, C, rho), 5);
  });
});

describe("geodesic fans", () => {
  it("orthonormal frame is orthonormal in g", () => {
    const g: [number, number, number, number] = [2, 0.7, 0.7, 1.5];
    const [f1, f2] = orthonormalFrame(g);
    expect(inner(g, f1, f1)).toBeCloseTo(1, 12);
    expect(inner(g, f2, f2)).toBeCloseTo(1, 12);
    expect(inner(g, f1, f2)).toBeCloseTo(0, 12);
  });

  it("sphere: neighbouring geodesics separate like sin s and refocus at s = π", () => {
    const { field } = setup("sphere", { a: 1 });
    const rays = geodesicFan(field, [Math.PI / 2, 0], Math.PI / 2, 0.01, 3, 3, () => true, 600);
    const sep = raySeparation(field, rays[1], rays[2]);
    const at = (s: number) => sep.reduce((b, x) => (Math.abs(x.s - s) < Math.abs(b.s - s) ? x : b));
    expect(at(Math.PI / 2).d / 0.01).toBeCloseTo(1, 3); // sin(π/2)·Δα
    expect(at(1).d / 0.01).toBeCloseTo(Math.sin(1), 3);
  });

  it("saddle: geodesics diverge faster than in the plane", () => {
    const { field } = setup("saddle", { k: 1 });
    const rays = geodesicFan(field, [0, 0], 0.3, 0.01, 3, 1.5, () => true, 300);
    const sep = raySeparation(field, rays[1], rays[2]);
    const last = sep.at(-1)!;
    expect(last.d / 0.01).toBeGreaterThan(last.s * 1.05);
  });
});
