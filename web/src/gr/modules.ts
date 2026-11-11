// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Макс
/**
 * Modules of the GR page. Each module will own a canvas layer, a panel and a
 * theory card; `ready: false` modules are shown in the toolbar as planned.
 * Adding one = implementing it against `Spacetime` (./spacetime.ts) and
 * flipping `ready`.
 */
export interface GRModule {
  id: "embedding" | "orbits" | "light" | "kerr";
  title: string;
  ready: boolean;
}

export const GR_MODULES: GRModule[] = [
  { id: "embedding", title: "Вкладення", ready: true },
  { id: "orbits", title: "Орбіти", ready: true },
  { id: "light", title: "Світло", ready: false },
  { id: "kerr", title: "Керр", ready: false },
];
