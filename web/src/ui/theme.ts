// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Макс
/** Colours shared by the canvas renderer and the SVG overlay (CSS mirrors them). */
export const COLORS = {
  e1: "#ffc857", // basis vector e₁ — warm yellow
  e2: "#ff5c8a", // basis vector e₂ — pink
  probe: "#f5f7ff",
  origin: "#8fb3ff",
  family0: [91, 124, 255] as const, // lines q¹ = const
  family1: [47, 168, 255] as const, // lines q² = const
  indicatrix: [94, 234, 212] as const,
  vec: "#7df9ff", // vector v, u
  vec2: "#c39bff", // vector w
  dual1: "#ffe7a8", // dual basis e¹ (lighter e₁)
  dual2: "#ffb3c9", // dual basis e² (lighter e₂)
  coordLine: "#5ee0ff", // coordinate-straight curve
  geodesic: "#7dff8a",
  cell: "#5eead4",
};

export const rgba = (c: readonly [number, number, number], a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
