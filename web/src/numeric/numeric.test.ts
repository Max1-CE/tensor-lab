// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Макс
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { IDENTITY_FRAME, makeChart, metricAt, toWorld, type Frame } from "../geometry/chart";
import type { V2 } from "../geometry/linalg";
import type { Analysis } from "../symbolic/types";
import { coordinateSegmentLength, geodesicAdaptive, integrate, shoot, shootTo } from "./curves";
import { fieldFor, inner, lower, numericChristoffel } from "./field";
import { rk4, rk45 } from "./ode";

const dir = join(__dirname, "..", "..", "public", "precomputed");
const load = (id: string) => JSON.parse(readFileSync(join(dir, `${id}.json`), "utf8")) as Analysis;
const SKEW: Frame = { O: [0.3, -0.2], A: [1.3, 0.4, -0.2, 0.8] };

describe("ODE integrators", () => {
  it("RK4 is fourth order", () => {
    const f = (_t: number, y: Float64Array, o: Float64Array) => {
      o[0] = y[0];
    };
    const err = (n: number) => Math.abs(rk4(f, [1], 0, 1, n)[n][0] - Math.E);
    const ratio = err(20) / err(40);
    expect(ratio).toBeGreaterThan(14);
    expect(ratio).toBeLessThan(18);
  });

  it("RK45 keeps a harmonic oscillator on its orbit and adapts the step", () => {
    const f = (_t: number, y: Float64Array, o: Float64Array) => {
      o[0] = y[1];
      o[1] = -y[0];
    };
    const r = rk45(f, [1, 0], 0, 10 * Math.PI, { rtol: 1e-10, atol: 1e-12 });
    expect(r.ok).toBe(true);
    const last = r.y[r.y.length - 1];
    expect(last[0]).toBeCloseTo(1, 7);
    expect(last[1]).toBeCloseTo(0, 7);
    expect(r.t.length).toBeLessThan(2000);
  });

  it("RK45 honours the stop condition", () => {
    const f = (_t: number, _y: Float64Array, o: Float64Array) => {
      o[0] = 1;
    };
    const r = rk45(f, [0], 0, 10, { stop: (_t, y) => y[0] > 3, hMax: 0.1 });
    expect(r.y.at(-1)![0]).toBeGreaterThan(3);
    expect(r.y.at(-1)![0]).toBeLessThan(3.2);
  });

  it("Gauss–Legendre quadrature", () => {
    expect(integrate(Math.sin, 0, Math.PI)).toBeCloseTo(2, 12);
  });
});

describe("metric field", () => {
  it.each(["polar", "elliptic", "parabolic"])(
    "%s: symbolic Γ equals numeric Γ of the pulled-back metric, for any linear frame",
    (id) => {
      const chart = makeChart(load(id));
      const q = chart.display.probe;
      for (const frame of [IDENTITY_FRAME, SKEW]) {
        const field = fieldFor(chart, frame, chart.defaults);
        const num = numericChristoffel((x) => metricAt(chart, frame, x, chart.defaults), q);
        field.christoffel(q).forEach((x, i) => expect(x).toBeCloseTo(num[i], 5));
      }
    },
  );

  it("index lowering and the inner product agree: v_i v^i = g(v, v)", () => {
    const g: [number, number, number, number] = [2, 0.5, 0.5, 3];
    const v: V2 = [0.7, -1.2];
    const lo = lower(g, v);
    expect(lo[0] * v[0] + lo[1] * v[1]).toBeCloseTo(inner(g, v, v), 14);
  });
});

describe("curve lengths and geodesics in the flat plane", () => {
  const polar = makeChart(load("polar"));

  it("polar: the coordinate line r = 1 from φ = 0 to π/2 is a quarter circle", () => {
    const L = coordinateSegmentLength(fieldFor(polar, IDENTITY_FRAME, {}), [1, 0], [1, Math.PI / 2]);
    expect(L).toBeCloseTo(Math.PI / 2, 10);
  });

  it.each([IDENTITY_FRAME, SKEW])("polar: the geodesic is the straight chord (frame %#)", (frame) => {
    const field = fieldFor(polar, frame, {});
    const A: V2 = [1, 0.2];
    const B: V2 = [2.5, 2.1];
    const res = shootTo(field, A, B);
    expect(res.converged).toBe(true);
    const wa = toWorld(polar, frame, A, {});
    const wb = toWorld(polar, frame, B, {});
    expect(res.length).toBeCloseTo(Math.hypot(wb[0] - wa[0], wb[1] - wa[1]), 6);
    // the midpoint of the path is the midpoint of the chord
    const mid = toWorld(polar, frame, res.points[res.points.length >> 1], {});
    expect(mid[0]).toBeCloseTo((wa[0] + wb[0]) / 2, 5);
    expect(mid[1]).toBeCloseTo((wa[1] + wb[1]) / 2, 5);
    // and it is shorter than the coordinate-straight curve
    expect(res.length).toBeLessThan(coordinateSegmentLength(field, A, B));
  });

  it("speed √g(ẋ, ẋ) is conserved along a geodesic", () => {
    const field = fieldFor(makeChart(load("elliptic")), IDENTITY_FRAME, { a: 1 });
    const p = shoot(field, [1, 0.5], [0.3, 0.8], 400);
    const speeds = p.points.map((x, i) => Math.sqrt(inner(field.g(x), p.velocities[i], p.velocities[i])));
    expect(Math.max(...speeds) - Math.min(...speeds)).toBeLessThan(1e-8);
  });
});

describe("geodesics on the sphere (abstract chart)", () => {
  const sphere = makeChart(load("sphere"));
  const field = fieldFor(sphere, IDENTITY_FRAME, { a: 1 });
  const greatCircle = (p: V2, q: V2) =>
    Math.acos(
      Math.cos(p[0]) * Math.cos(q[0]) + Math.sin(p[0]) * Math.sin(q[0]) * Math.cos(q[1] - p[1]),
    );

  it("equator arc has length Δφ", () => {
    const r = shootTo(field, [Math.PI / 2, 0], [Math.PI / 2, 1]);
    expect(r.converged).toBe(true);
    expect(r.length).toBeCloseTo(1, 8);
  });

  it("matches the great-circle distance and beats the coordinate line", () => {
    const A: V2 = [0.9, 0.2];
    const B: V2 = [2.0, 2.2];
    const r = shootTo(field, A, B);
    expect(r.converged).toBe(true);
    expect(r.length).toBeCloseTo(greatCircle(A, B), 7);
    expect(r.length).toBeLessThan(coordinateSegmentLength(field, A, B));
  });

  it("adaptive integration of a meridian reaches the pole region smoothly", () => {
    const g = geodesicAdaptive(field, [Math.PI / 2, 0], [-1, 0], 1.2);
    expect(g.ok).toBe(true);
    expect(g.points.at(-1)![0]).toBeCloseTo(Math.PI / 2 - 1.2, 8);
    expect(g.points.at(-1)![1]).toBeCloseTo(0, 10);
  });
});
