// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Макс
import { create } from "zustand";
import type { Params } from "../symbolic/compile";
import type { PresetMeta } from "../symbolic/types";
import { IDENTITY_FRAME, type Chart, type Frame } from "../geometry/chart";
import { easeInOutCubic, morphGrid, sampleGrid, type Line } from "../geometry/grid";
import type { V2 } from "../geometry/linalg";
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
}

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
  resetFrame: () => {
    const s = get();
    const from = currentLines(s);
    set({
      frame: IDENTITY_FRAME,
      morph: from ? { from, start: performance.now() } : null,
    });
  },
}));
