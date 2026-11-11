// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Макс
/** Coordinate-line sampling and the morph between two grids. */
import type { Params } from "../symbolic/compile";
import { toWorld, type Chart, type Frame } from "./chart";
import type { V2 } from "./linalg";

/** One polyline: interleaved world coordinates x0, y0, x1, y1, … */
export type Line = Float64Array;

export interface Grid {
  /** families[i] = lines q^i = const (they run along the other coordinate). */
  families: [Line[], Line[]];
  /** The constant value of each line, per family. */
  values: [number[], number[]];
}

export const SAMPLES = 160;

export function axisValues(chart: Chart, i: 0 | 1): number[] {
  const a = chart.display.axes[i];
  const [lo, hi] = a.range;
  const n = a.lines;
  const step = a.periodic ? (hi - lo) / n : (hi - lo) / (n - 1);
  return Array.from({ length: n }, (_, k) => lo + k * step);
}

/** World polyline of the coordinate line q^i = value. */
export function coordinateLine(
  chart: Chart,
  frame: Frame,
  p: Params,
  i: 0 | 1,
  value: number,
  samples = SAMPLES,
): Line {
  const other = chart.display.axes[1 - i];
  const [lo, hi] = other.range;
  const out = new Float64Array(samples * 2);
  for (let s = 0; s < samples; s++) {
    const t = lo + ((hi - lo) * s) / (samples - 1);
    const q: V2 = i === 0 ? [value, t] : [t, value];
    const w = toWorld(chart, frame, q, p);
    out[2 * s] = w[0];
    out[2 * s + 1] = w[1];
  }
  return out;
}

export function sampleGrid(chart: Chart, frame: Frame, p: Params, samples = SAMPLES): Grid {
  const v0 = axisValues(chart, 0);
  const v1 = axisValues(chart, 1);
  return {
    families: [
      v0.map((v) => coordinateLine(chart, frame, p, 0, v, samples)),
      v1.map((v) => coordinateLine(chart, frame, p, 1, v, samples)),
    ],
    values: [v0, v1],
  };
}

/**
 * Interpolate two families of lines with possibly different counts.
 * Line j of n = max(a, b) blends a[⌊j·a/n⌋] and b[⌊j·b/n⌋]; extra lines collapse
 * onto their neighbours, which reads as lines splitting or merging.
 */
export function morphFamily(from: Line[], to: Line[], t: number): Line[] {
  if (from.length === 0) return to;
  if (to.length === 0) return from;
  const n = Math.max(from.length, to.length);
  const out: Line[] = [];
  for (let j = 0; j < n; j++) {
    const a = from[Math.floor((j * from.length) / n)];
    const b = to[Math.floor((j * to.length) / n)];
    const len = Math.min(a.length, b.length);
    const l = new Float64Array(len);
    for (let k = 0; k < len; k++) l[k] = a[k] + (b[k] - a[k]) * t;
    out.push(l);
  }
  return out;
}

export function morphGrid(from: Grid, to: Grid, t: number): [Line[], Line[]] {
  return [morphFamily(from.families[0], to.families[0], t), morphFamily(from.families[1], to.families[1], t)];
}

export const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
