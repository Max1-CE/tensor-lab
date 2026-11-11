// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Макс
/** SVG primitives for the overlay (screen coordinates). */
import type { PointerEvent } from "react";
import type { V2 } from "../geometry/linalg";

export function Label({ at, color, text, sub, sup, size = 17, anchor = "middle" }: {
  at: V2; color: string; text: string; sub?: string; sup?: string; size?: number; anchor?: "start" | "middle" | "end";
}) {
  return (
    <text x={at[0]} y={at[1]} fill={color} className="vec-label" fontSize={size} textAnchor={anchor} dominantBaseline="middle">
      {text}
      {sup && (
        <tspan baselineShift="super" fontSize="0.68em">
          {sup}
        </tspan>
      )}
      {sub && (
        <tspan baselineShift="sub" fontSize="0.68em" dx={sup ? "-0.35em" : undefined}>
          {sub}
        </tspan>
      )}
    </text>
  );
}

export function Arrow({ from, to, color, width = 3, dashed = false, glow = true, head = 15, opacity = 1 }: {
  from: V2; to: V2; color: string; width?: number; dashed?: boolean; glow?: boolean; head?: number; opacity?: number;
}) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const len = Math.hypot(dx, dy);
  if (len < 1) return null;
  const ux = dx / len;
  const uy = dy / len;
  const h = Math.min(head, len * 0.4);
  const neck: V2 = [to[0] - ux * h * 0.85, to[1] - uy * h * 0.85];
  const pts = `${to[0]},${to[1]} ${to[0] - ux * h - uy * h * 0.42},${to[1] - uy * h + ux * h * 0.42} ${to[0] - ux * h + uy * h * 0.42},${to[1] - uy * h - ux * h * 0.42}`;
  return (
    <g filter={glow ? "url(#glow)" : undefined} opacity={opacity} pointerEvents="none">
      <line
        x1={from[0]}
        y1={from[1]}
        x2={neck[0]}
        y2={neck[1]}
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        strokeDasharray={dashed ? "6 5" : undefined}
      />
      <polygon points={pts} fill={color} />
    </g>
  );
}

export function Seg({ a, b, color, width = 1.4, dash = "4 4", opacity = 0.8 }: {
  a: V2; b: V2; color: string; width?: number; dash?: string; opacity?: number;
}) {
  return (
    <line
      x1={a[0]}
      y1={a[1]}
      x2={b[0]}
      y2={b[1]}
      stroke={color}
      strokeWidth={width}
      strokeDasharray={dash}
      opacity={opacity}
      pointerEvents="none"
    />
  );
}

export function Poly({ pts, color, width = 2.5, dash, fill = "none", opacity = 1, glow = false }: {
  pts: V2[]; color: string; width?: number; dash?: string; fill?: string; opacity?: number; glow?: boolean;
}) {
  if (pts.length < 2) return null;
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join("");
  return (
    <path
      d={fill !== "none" ? d + "Z" : d}
      stroke={color}
      strokeWidth={width}
      strokeDasharray={dash}
      fill={fill}
      opacity={opacity}
      strokeLinejoin="round"
      strokeLinecap="round"
      filter={glow ? "url(#glow)" : undefined}
      pointerEvents="none"
    />
  );
}

/** A round draggable handle (invisible hit area + optional visible dot). */
export function Grip({ at, onDown, dot, color = "#fff", r = 13, label }: {
  at: V2; onDown: (e: PointerEvent) => void; dot?: number; color?: string; r?: number; label?: string;
}) {
  return (
    <g className="handle" transform={`translate(${at[0]},${at[1]})`} onPointerDown={onDown}>
      <circle r={r} className="hit" />
      {dot && <circle r={dot} fill={color} filter="url(#glow)" />}
      {label && (
        <text x={-12} y={19} className="pt-label" fill={color}>
          {label}
        </text>
      )}
    </g>
  );
}
