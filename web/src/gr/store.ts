// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Макс
import { create } from "zustand";

export type GRElement = "metric" | "flamm" | "horizon" | "photon" | "isco" | "probe" | "mass";

export interface GRState {
  /** Target mass (slider) and the displayed mass (eased towards the target). */
  M: number;
  shownM: number;
  /** Probe radius in units of M (so it scales with the mass). */
  probeX: number;
  selected: GRElement;
  hover: GRElement | null;
  show: { horizon: boolean; photon: boolean; isco: boolean; probe: boolean; secondSheet: boolean };
  az: number;
  el: number;
  set(p: Partial<GRState>): void;
  toggle(k: keyof GRState["show"]): void;
}

export const R_MAX = 26;
export const M_RANGE: [number, number] = [0.3, 3.5];

export const useGR = create<GRState>((set) => ({
  M: 1.5,
  shownM: 1.5,
  probeX: 4.5,
  selected: "flamm",
  hover: null,
  show: { horizon: true, photon: true, isco: true, probe: true, secondSheet: false },
  az: -0.6,
  el: 0.55,
  set: (p) => set(p),
  toggle: (k) => set((s) => ({ show: { ...s.show, [k]: !s.show[k] } })),
}));
