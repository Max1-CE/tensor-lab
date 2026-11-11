// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Макс
import { create } from "zustand";
import type { GRModule } from "./modules";

export type GRElement =
  | "metric"
  | "flamm"
  | "horizon"
  | "photon"
  | "isco"
  | "probe"
  | "mass"
  | "orbit"
  | "veff"
  | "precession";

export interface GRState {
  module: GRModule["id"];
  /** Target mass (slider) and the displayed mass (eased towards the target). */
  M: number;
  shownM: number;
  /** Probe radius in units of M (so it scales with the mass). */
  probeX: number;
  selected: GRElement;
  hover: GRElement | null;
  show: { horizon: boolean; photon: boolean; isco: boolean; probe: boolean; secondSheet: boolean; newton: boolean };
  az: number;
  el: number;
  /** Orbit module: turning points in units of M, current angle φ along the track, playback. */
  orbitRp: number;
  orbitRa: number;
  orbitPhi: number;
  playing: boolean;
  set(p: Partial<GRState>): void;
  toggle(k: keyof GRState["show"]): void;
}

export const R_MAX = 26;
export const M_RANGE: [number, number] = [0.3, 3.5];
export const VIEW_3D = { el: 0.55 };
export const VIEW_TOP = { el: 1.45 };

export const useGR = create<GRState>((set) => ({
  module: "embedding",
  M: 1.5,
  shownM: 1.5,
  probeX: 4.5,
  selected: "flamm",
  hover: null,
  show: { horizon: true, photon: true, isco: true, probe: true, secondSheet: false, newton: true },
  az: -0.6,
  el: VIEW_3D.el,
  orbitRp: 12,
  orbitRa: 24,
  orbitPhi: 0,
  playing: true,
  set: (p) => set(p),
  toggle: (k) => set((s) => ({ show: { ...s.show, [k]: !s.show[k] } })),
}));
