// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Макс
/**
 * Compile the JS function bodies emitted by core/export.py.
 * Each body is `(x, p) => number[]`, with x the coordinates and p the parameters.
 * They are compiled once per analysis; the integrators then call plain functions.
 */
import type { Analysis } from "./types";

export type Params = Record<string, number>;
export type VecFn = (x: ArrayLike<number>, p: Params) => number[];

export interface CompiledAnalysis {
  dim: number;
  metric: VecFn; // flat n×n, row-major
  inverse: VecFn; // flat n×n
  christoffel: VecFn; // flat n×n×n, index [l][m][k] = Γ^l_{mk}
  scalar: VecFn; // [R]
  embedding?: VecFn; // map into ℝ² or ℝ³
}

export function compileBody(body: string): VecFn {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  return new Function("x", "p", body) as VecFn;
}

const cache = new WeakMap<Analysis, CompiledAnalysis>();

export function compileAnalysis(a: Analysis): CompiledAnalysis {
  const hit = cache.get(a);
  if (hit) return hit;
  const out: CompiledAnalysis = {
    dim: a.dim,
    metric: compileBody(a.js.metric),
    inverse: compileBody(a.js.inverse),
    christoffel: compileBody(a.js.christoffel),
    scalar: compileBody(a.js.scalar),
    embedding: a.js.embedding ? compileBody(a.js.embedding) : undefined,
  };
  cache.set(a, out);
  return out;
}

export function defaultParams(a: Analysis): Params {
  return Object.fromEntries(a.params.map((p) => [p.name, p.default]));
}
