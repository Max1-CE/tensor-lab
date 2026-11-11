// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Макс
/**
 * SVG overlay with the draggable handles: origin O, probe point P and the tips
 * of the basis vectors e₁, e₂. Dragging the background pans, the wheel zooms.
 */
import { useRef, useState, type PointerEvent, type WheelEvent } from "react";
import {
  frameWithLocalBasis,
  fromWorld,
  localBasis,
  toWorld,
} from "../geometry/chart";
import { col, det, fromCols, sub, type M2, type V2 } from "../geometry/linalg";
import { toScreen, toWorldPt, zoomAt } from "../geometry/viewport";
import { useLab } from "../state/store";
import { COLORS } from "../ui/theme";

type DragKind = "origin" | "probe" | "e0" | "e1" | "pan";
interface Drag {
  kind: DragKind;
  id: number;
  offset: V2; // world offset between the pointer and the handle
  last: V2; // last screen position (for panning)
}

const snap = (x: number, step = 0.25) => Math.round(x / step) * step;

function Arrow({ from, to, color, label, sub: subscript, active }: {
  from: V2; to: V2; color: string; label: string; sub: string; active: boolean;
}) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const h = Math.min(15, len * 0.4);
  const neck: V2 = [to[0] - ux * h * 0.85, to[1] - uy * h * 0.85];
  const head = `${to[0]},${to[1]} ${to[0] - ux * h - uy * h * 0.42},${to[1] - uy * h + ux * h * 0.42} ${to[0] - ux * h + uy * h * 0.42},${to[1] - uy * h - ux * h * 0.42}`;
  const lx = to[0] + ux * 16 - uy * 10;
  const ly = to[1] + uy * 16 + ux * 10;
  return (
    <g className={active ? "vec active" : "vec"} filter="url(#glow)">
      <line x1={from[0]} y1={from[1]} x2={neck[0]} y2={neck[1]} stroke={color} strokeWidth={3} strokeLinecap="round" />
      <polygon points={head} fill={color} />
      <text x={lx} y={ly} fill={color} className="vec-label" textAnchor="middle" dominantBaseline="middle">
        {label}
        <tspan baselineShift="sub" fontSize="0.7em">{subscript}</tspan>
      </text>
    </g>
  );
}

export function Overlay() {
  const s = useLab();
  const drag = useRef<Drag | null>(null);
  const [active, setActive] = useState<DragKind | null>(null);
  const { chart, view, frame, params } = s;
  if (!chart || view.width < 2) return <svg className="layer overlay" />;

  const affine = chart.display.affine;
  const q: V2 = affine ? [0, 0] : s.probe;
  const P = toWorld(chart, frame, q, params);
  const E = localBasis(chart, frame, q, params);
  const Ps = toScreen(view, P);
  const Os = toScreen(view, frame.O);
  const tips = [0, 1].map((i) => toScreen(view, [P[0] + col(E, i as 0 | 1)[0], P[1] + col(E, i as 0 | 1)[1]]));
  const editable = chart.kind === "embedded";

  const worldOf = (e: PointerEvent): V2 => {
    const r = (e.currentTarget as SVGElement).ownerSVGElement?.getBoundingClientRect()
      ?? (e.currentTarget as SVGElement).getBoundingClientRect();
    return toWorldPt(view, [e.clientX - r.left, e.clientY - r.top]);
  };

  const start = (kind: DragKind) => (e: PointerEvent) => {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const w = worldOf(e);
    const anchor: V2 =
      kind === "origin" ? frame.O
      : kind === "probe" ? P
      : kind === "e0" ? [P[0] + E[0], P[1] + E[2]]
      : kind === "e1" ? [P[0] + E[1], P[1] + E[3]]
      : w;
    drag.current = { kind, id: e.pointerId, offset: sub(anchor, w), last: [e.clientX, e.clientY] };
    setActive(kind);
  };

  const move = (e: PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const st = useLab.getState();
    if (d.kind === "pan") {
      const dx = e.clientX - d.last[0];
      const dy = e.clientY - d.last[1];
      d.last = [e.clientX, e.clientY];
      st.setView({ pan: [st.view.pan[0] + dx, st.view.pan[1] + dy] });
      return;
    }
    let w = worldOf(e);
    w = [w[0] + d.offset[0], w[1] + d.offset[1]];
    if (e.shiftKey) w = [snap(w[0]), snap(w[1])];
    if (d.kind === "origin") {
      st.setFrame({ ...st.frame, O: w });
    } else if (d.kind === "probe") {
      st.setProbe(fromWorld(chart, st.frame, w, st.probe, st.params));
    } else {
      const i = d.kind === "e0" ? 0 : 1;
      const qq: V2 = affine ? [0, 0] : st.probe;
      const P0 = toWorld(chart, st.frame, qq, st.params);
      const E0 = localBasis(chart, st.frame, qq, st.params);
      const v = sub(w, P0);
      const cols: [V2, V2] = [col(E0, 0), col(E0, 1)];
      cols[i] = v;
      const En: M2 = fromCols(cols[0], cols[1]);
      // refuse (nearly) degenerate bases: the metric would lose its inverse
      if (Math.hypot(v[0], v[1]) < 0.08 || Math.abs(det(En)) < 0.02) return;
      st.setFrame(frameWithLocalBasis(chart, st.frame, qq, st.params, En));
    }
  };

  const end = (e: PointerEvent) => {
    if (drag.current?.id === e.pointerId) {
      drag.current = null;
      setActive(null);
    }
  };

  const wheel = (e: WheelEvent) => {
    const r = (e.currentTarget as SVGElement).getBoundingClientRect();
    const st = useLab.getState();
    st.setView(zoomAt(st.view, [e.clientX - r.left, e.clientY - r.top], Math.exp(-e.deltaY * 0.0015)));
  };

  return (
    <svg
      className={`layer overlay${active ? " dragging" : ""}`}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      onWheel={wheel}
    >
      <defs>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect className="pan-surface" width="100%" height="100%" onPointerDown={start("pan")} />

      {!affine && (
        <g className="handle origin" onPointerDown={start("origin")} transform={`translate(${Os[0]},${Os[1]})`}>
          <circle r={14} className="hit" />
          <circle r={6} fill="none" stroke={COLORS.origin} strokeWidth={1.6} />
          <path d="M-11 0H-7M7 0H11M0 -11V-7M0 7V11" stroke={COLORS.origin} strokeWidth={1.6} />
          <text x={10} y={18} className="pt-label" fill={COLORS.origin}>O</text>
        </g>
      )}

      <Arrow from={Ps} to={tips[0]} color={COLORS.e1} label="e" sub="1" active={active === "e0"} />
      <Arrow from={Ps} to={tips[1]} color={COLORS.e2} label="e" sub="2" active={active === "e1"} />

      <g
        className="handle probe"
        onPointerDown={start(affine ? "origin" : "probe")}
        transform={`translate(${Ps[0]},${Ps[1]})`}
      >
        <circle r={14} className="hit" />
        <circle r={5.5} fill={COLORS.probe} filter="url(#glow)" />
        <text x={-14} y={20} className="pt-label" fill={COLORS.probe}>{affine ? "O" : "P"}</text>
      </g>

      {editable &&
        tips.map((t, i) => (
          <circle
            key={i}
            className="handle tip"
            cx={t[0]}
            cy={t[1]}
            r={13}
            onPointerDown={start(i === 0 ? "e0" : "e1")}
          />
        ))}
    </svg>
  );
}
