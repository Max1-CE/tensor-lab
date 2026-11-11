// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Макс
/** Shape of the JSON produced by core/export.py (schema 1). */

export interface CoordInfo {
  name: string;
  latex: string;
}

export interface ParamInfo {
  name: string;
  latex: string;
  default: number;
}

export interface IndexedTex {
  indices: number[];
  latex: string;
}

export interface Analysis {
  schema: 1;
  name: string;
  dim: number;
  lorentzian: boolean;
  coords: CoordInfo[];
  params: ParamInfo[];
  metric: { latex: string; components: string[][] };
  inverse: { latex: string; components: string[][] };
  det: string;
  sqrtAbsDet: string;
  kroneckerOk: boolean;
  lineElement: string;
  christoffel: { upper: number; lower: [number, number]; latex: string }[];
  riemann: { independentCount: number; nonzero: IndexedTex[] };
  ricci: IndexedTex[];
  ricciFlat: boolean;
  scalar: string;
  einstein: IndexedTex[];
  kretschmann?: string;
  gaussian?: string;
  leviCivita: {
    latex: string;
    lower: { indices: number[]; value: string }[];
    upper: { indices: number[]; value: string }[];
  };
  geodesics: string[];
  js: {
    metric: string;
    inverse: string;
    christoffel: string;
    scalar: string;
    embedding?: string;
  };
  // Added by scripts/precompute.py for presets:
  id?: string;
  title?: string;
  kind?: "plane" | "surface" | "spacetime";
  domain?: [number, number][];
}

export interface PresetMeta {
  id: string;
  title: string;
  kind: "plane" | "surface" | "spacetime";
  dim: number;
  domain: [number, number][];
}

/** Result of the worker's analyze call. */
export type WorkerResult =
  | { ok: true; result: Analysis }
  | { ok: false; code: string; detail: string };
