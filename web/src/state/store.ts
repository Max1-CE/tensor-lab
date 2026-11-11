// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Макс
import { create } from "zustand";
import type { Params } from "../symbolic/compile";
import type { PresetMeta } from "../symbolic/types";
import { IDENTITY_FRAME, clampToDomain, localBasis, type Chart, type Frame } from "../geometry/chart";
import { easeInOutCubic, morphGrid, sampleGrid, type Line } from "../geometry/grid";
import { mulV, type V2 } from "../geometry/linalg";
import { fitBox, type Viewport } from "../geometry/viewport";

export type ToolId =
  | "frame"
  | "metric"
  | "length"
  | "vector"
  | "angle"
  | "christoffel"
  | "transport"
  | "geodesic"
  | "curvature"
  | "symbols";

export type PageId = "geometry" | "gr";

export const MORPH_MS = 900;
export const DEFAULT_SCALE = 70;

interface Morph {
  from: [Line[], Line[]];
  start: number;
}

export interface LabState {
  page: PageId;
  index: PresetMeta[];
  chart: Chart | null;
  params: Params;
  frame: Frame;
  probe: V2;
  view: Viewport;
  tool: ToolId;
  theoryOpen: boolean;
  showField: boolean;
  morph: Morph | null;

  // --- tool state (stage 3) ---
  /** Length tool: endpoints A, B in chart coordinates. */
  lengthPts: [V2, V2];
  /** Vector tool: the vector v at P, in world coordinates (a geometric object). */
  vec: V2;
  /** Angle tool: vectors u, w at P, in world coordinates. */
  angleVecs: [V2, V2];
  /** Vector tool: also show the dual basis and the covariant decomposition. */
  showDual: boolean;
  /** Metric tool: size of the coordinate cell, as a fraction of the grid step. */
  cellFrac: number;

  setPage(p: PageId): void;
  setIndex(i: PresetMeta[]): void;
  setChart(c: Chart): void;
  setParam(name: string, value: number): void;
  setFrame(f: Frame): void;
  setProbe(q: V2): void;
  setView(v: Partial<Viewport>): void;
  setTool(t: ToolId): void;
  toggleTheory(open?: boolean): void;
  toggleField(): void;
  resetFrame(): void;
  setLengthPt(i: 0 | 1, q: V2): void;
  setVec(w: V2): void;
  setAngleVec(i: 0 | 1, w: V2): void;
  toggleDual(): void;
  setCellFrac(f: number): void;
}

/** Default tool objects for a chart, placed near the probe point. */
export function toolDefaults(chart: Chart): Pick<LabState, "lengthPts" | "vec" | "angleVecs"> {
  const [a, b] = chart.display.axes;
  const P = chart.display.probe;
  const span: V2 = [a.range[1] - a.range[0], b.range[1] - b.range[0]];
  // world unit for abstract charts is a coordinate unit: scale vectors to the box
  const u = chart.kind === "abstract" ? 0.22 * Math.min(span[0], span[1]) : 1;
  const B: V2 = chart.kind === "abstract"
    ? [P[0] + 0.3 * span[0], P[1] + 0.3 * span[1]]
    : DEFAULT_B[chart.id] ?? [P[0] + 0.25 * span[0], P[1] + 0.25 * span[1]];
  return {
    lengthPts: [[...P], clampToDomain(chart, B)],
    vec: chart.kind === "embedded" ? mulV(localBasis(chart, IDENTITY_FRAME, P, chart.defaults), [1.1, 0.45]) : [1.3 * u, 0.8 * u],
    angleVecs: [[1.5 * u, 0.4 * u], [0.5 * u, 1.3 * u]],
  };
}

const DEFAULT_B: Record<string, V2> = {
  cartesian: [3, -2],
  skew: [3, -2],
  polar: [3, 2.6],
  elliptic: [1.4, 2.8],
  parabolic: [-1.2, 1.6],
};

/** Lines currently on screen (mid-morph if a morph is running). */
export function currentLines(s: LabState, now = performance.now()): [Line[], Line[]] | null {
  if (!s.chart) return null;
  const grid = sampleGrid(s.chart, s.frame, s.params);
  if (!s.morph) return grid.families;
  const t = Math.min(1, (now - s.morph.start) / MORPH_MS);
  if (t >= 1) return grid.families;
  return morphGrid({ families: s.morph.from, values: [[], []] }, grid, easeInOutCubic(t));
}

export const useLab = create<LabState>((set, get) => ({
  page: "geometry",
  index: [],
  chart: null,
  params: {},
  frame: IDENTITY_FRAME,
  probe: [0, 0],
  view: { width: 1, height: 1, pan: [0, 0], scale: DEFAULT_SCALE },
  tool: "frame",
  theoryOpen: true,
  showField: false,
  morph: null,
  lengthPts: [[0, 0], [3, -2]],
  vec: [1.3, 0.8],
  angleVecs: [[1.5, 0.4], [0.5, 1.3]],
  showDual: true,
  cellFrac: 1,

  setPage: (page) => set({ page }),
  setIndex: (index) => set({ index }),
  setChart: (chart) => {
    const s = get();
    const from = currentLines(s);
    let view = s.view;
    if (chart.kind === "abstract") {
      // a user metric lives in its own coordinate box: fit it into the free area
      const [a, b] = chart.display.axes;
      const wide = view.width > 760;
      view = fitBox(view, [a.range[0], a.range[1], b.range[0], b.range[1]], {
        left: wide ? 360 : 0,
        right: wide && s.theoryOpen ? 410 : 0,
        top: 0,
        bottom: wide ? 0 : view.height * 0.48,
      });
    } else if (s.chart?.kind === "abstract") {
      view = { ...view, pan: [0, 0], scale: DEFAULT_SCALE };
    }
    set({
      view,
      chart,
      params: { ...chart.defaults },
      frame: IDENTITY_FRAME,
      probe: [...chart.display.probe],
      ...toolDefaults(chart),
      morph: from ? { from, start: performance.now() } : null,
    });
  },
  setParam: (name, value) => set((s) => ({ params: { ...s.params, [name]: value } })),
  setFrame: (frame) => set({ frame }),
  setProbe: (probe) => set({ probe }),
  setView: (v) => set((s) => ({ view: { ...s.view, ...v } })),
  setTool: (tool) => set({ tool, theoryOpen: true }),
  toggleTheory: (open) => set((s) => ({ theoryOpen: open ?? !s.theoryOpen })),
  toggleField: () => set((s) => ({ showField: !s.showField })),
  setLengthPt: (i, q) =>
    set((s) => {
      const pts: [V2, V2] = [s.lengthPts[0], s.lengthPts[1]];
      pts[i] = q;
      return { lengthPts: pts };
    }),
  setVec: (vec) => set({ vec }),
  setAngleVec: (i, w) =>
    set((s) => {
      const v: [V2, V2] = [s.angleVecs[0], s.angleVecs[1]];
      v[i] = w;
      return { angleVecs: v };
    }),
  toggleDual: () => set((s) => ({ showDual: !s.showDual })),
  setCellFrac: (cellFrac) => set({ cellFrac }),
  resetFrame: () => {
    const s = get();
    const from = currentLines(s);
    set({
      frame: IDENTITY_FRAME,
      morph: from ? { from, start: performance.now() } : null,
    });
  },
}));
