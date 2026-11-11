// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Макс
/** World (math, y up) ↔ screen (CSS px, y down). */
import type { V2 } from "./linalg";

export interface Viewport {
  width: number;
  height: number;
  pan: V2; // screen offset of the world origin from the screen centre
  scale: number; // px per world unit
}

export const toScreen = (v: Viewport, w: V2): V2 => [
  v.width / 2 + v.pan[0] + w[0] * v.scale,
  v.height / 2 + v.pan[1] - w[1] * v.scale,
];

export const toWorldPt = (v: Viewport, s: V2): V2 => [
  (s[0] - v.width / 2 - v.pan[0]) / v.scale,
  -(s[1] - v.height / 2 - v.pan[1]) / v.scale,
];

/** Screen vector of a world vector (no translation). */
export const vecToScreen = (v: Viewport, w: V2): V2 => [w[0] * v.scale, -w[1] * v.scale];

export const MIN_SCALE = 15;
export const MAX_SCALE = 400;

export interface Insets {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** Pan and scale that fit the world box [x0, x1] × [y0, y1] into the free area. */
export function fitBox(v: Viewport, box: [number, number, number, number], insets: Insets, margin = 0.85): Viewport {
  const [x0, x1, y0, y1] = box;
  const freeW = Math.max(50, v.width - insets.left - insets.right);
  const freeH = Math.max(50, v.height - insets.top - insets.bottom);
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, margin * Math.min(freeW / (x1 - x0), freeH / (y1 - y0))));
  const cx = insets.left + freeW / 2;
  const cy = insets.top + freeH / 2;
  const mx = (x0 + x1) / 2;
  const my = (y0 + y1) / 2;
  return { ...v, scale, pan: [cx - v.width / 2 - mx * scale, cy - v.height / 2 + my * scale] };
}

/** Zoom by `factor` keeping the world point under screen point `at` fixed. */
export function zoomAt(v: Viewport, at: V2, factor: number): Viewport {
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * factor));
  const w = toWorldPt(v, at);
  const pan: V2 = [at[0] - v.width / 2 - w[0] * scale, at[1] - v.height / 2 + w[1] * scale];
  return { ...v, scale, pan };
}
