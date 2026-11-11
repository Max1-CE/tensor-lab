// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Макс
/**
 * SVG overlay: the basis frame (origin O, probe P, tips of e₁, e₂) and the
 * graphics/handles of the active tool. Dragging the background pans, the wheel zooms.
 */
import { useRef, useState, type PointerEvent, type WheelEvent } from "react";
import { frameWithLocalBasis, fromWorld, localBasis, toWorld, type Chart, type Frame } from "../geometry/chart";
import { col, det, fromCols, sub, type M2, type V2 } from "../geometry/linalg";
import { toScreen, toWorldPt, zoomAt, type Viewport } from "../geometry/viewport";
import { useLab, type ToolId } from "../state/store";
import type { Params } from "../symbolic/compile";
import { COLORS } from "../ui/theme";
import { Arrow, Grip, Label } from "./svg";
import { AngleLayer, LengthLayer, MetricLayer, VectorLayer } from "./tools";
import { ChristoffelLayer, FanLayer, SymbolsLayer, TransportLayer } from "./tools2";

export type MoveFn = (w: V2, e: PointerEvent) => void;

export interface LayerCtx {
  chart: Chart;
  frame: Frame;
  params: Params;
  view: Viewport;
  probe: V2;
  toS: (w: V2) => V2;
  /** Start dragging a handle whose world position is `anchor`. */
  begin: (id: string, e: PointerEvent, anchor: V2, onMove: MoveFn) => void;
  active: string | null;
}

interface Drag {
  id: string;
  pointer: number;
  offset: V2;
  last: V2;
  onMove: MoveFn | null; // null = pan
}

export const snap = (x: number, step = 0.25) => Math.round(x / step) * step;

/** Tools that draw the basis frame at P. */
const SHOW_FRAME: Record<ToolId, boolean> = {
  frame: true,
  metric: true,
  length: false,
  vector: true,
  angle: false,
  christoffel: true,
  transport: false,
  geodesic: false,
  curvature: true,
  symbols: false,
};

function FrameLayer({ ctx }: { ctx: LayerCtx }) {
  const { chart, frame, params, view, toS, begin, active } = ctx;
  const affine = chart.display.affine;
  const q: V2 = affine ? [0, 0] : ctx.probe;
  const P = toWorld(chart, frame, q, params);
  const E = localBasis(chart, frame, q, params);
  const Ps = toS(P);
  const tipsW = [0, 1].map((i) => {
    const c = col(E, i as 0 | 1);
    return [P[0] + c[0], P[1] + c[1]] as V2;
  });
  const tips = tipsW.map(toS);
  const editable = chart.kind === "embedded";
  const colors = [COLORS.e1, COLORS.e2];

  const dragTip = (i: 0 | 1): MoveFn => (w, e) => {
    if (e.shiftKey) w = [snap(w[0]), snap(w[1])];
    const st = useLab.getState();
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
  };
  const dragOrigin: MoveFn = (w, e) => {
    if (e.shiftKey) w = [snap(w[0]), snap(w[1])];
    const st = useLab.getState();
    st.setFrame({ ...st.frame, O: w });
  };
  const dragProbe: MoveFn = (w) => {
    const st = useLab.getState();
    st.setProbe(fromWorld(chart, st.frame, w, st.probe, st.params));
  };
  const Os = toScreen(view, frame.O);

  return (
    <g>
      {!affine && (
        <g className="handle origin" onPointerDown={(e) => begin("origin", e, frame.O, dragOrigin)} transform={`translate(${Os[0]},${Os[1]})`}>
          <circle r={14} className="hit" />
          <circle r={6} fill="none" stroke={COLORS.origin} strokeWidth={1.6} />
          <path d="M-11 0H-7M7 0H11M0 -11V-7M0 7V11" stroke={COLORS.origin} strokeWidth={1.6} />
          <text x={10} y={18} className="pt-label" fill={COLORS.origin}>O</text>
        </g>
      )}
      {tips.map((t, i) => {
        const dx = t[0] - Ps[0];
        const dy = t[1] - Ps[1];
        const l = Math.hypot(dx, dy) || 1;
        return (
          <g key={i} className={active === `e${i}` ? "vec active" : "vec"}>
            <Arrow from={Ps} to={t} color={colors[i]} />
            <Label at={[t[0] + (dx / l) * 16 - (dy / l) * 10, t[1] + (dy / l) * 16 + (dx / l) * 10]} color={colors[i]} text="e" sub={String(i + 1)} />
          </g>
        );
      })}
      <Grip
        at={Ps}
        dot={5.5}
        color={COLORS.probe}
        label={affine ? "O" : "P"}
        r={14}
        onDown={(e) => (affine ? begin("origin", e, frame.O, dragOrigin) : begin("probe", e, P, dragProbe))}
      />
      {editable &&
        tips.map((t, i) => (
          <circle
            key={i}
            className="handle tip"
            cx={t[0]}
            cy={t[1]}
            r={13}
            onPointerDown={(e) => begin(`e${i}`, e, tipsW[i], dragTip(i as 0 | 1))}
          />
        ))}
    </g>
  );
}

export function Overlay() {
  const s = useLab();
  const drag = useRef<Drag | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const { chart, view } = s;
  if (!chart || view.width < 2) return <svg className="layer overlay" />;

  const svgRect = (e: PointerEvent | WheelEvent) => {
    const el = e.currentTarget as SVGElement;
    return (el.ownerSVGElement ?? el).getBoundingClientRect();
  };
  const worldOf = (e: PointerEvent): V2 => {
    const r = svgRect(e);
    return toWorldPt(useLab.getState().view, [e.clientX - r.left, e.clientY - r.top]);
  };

  const begin = (id: string, e: PointerEvent, anchor: V2, onMove: MoveFn | null) => {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const w = worldOf(e);
    drag.current = { id, pointer: e.pointerId, offset: sub(anchor, w), last: [e.clientX, e.clientY], onMove };
    setActive(id);
  };

  const move = (e: PointerEvent) => {
    const d = drag.current;
    if (!d && useLab.getState().tool === "curvature") {
      const st = useLab.getState();
      const w = worldOf(e);
      const q = st.chart!.kind === "abstract" ? w : fromWorld(st.chart!, st.frame, w, st.hoverQ ?? st.probe, st.params);
      st.set({ hoverQ: q });
    }
    if (!d || d.pointer !== e.pointerId) return;
    if (!d.onMove) {
      const st = useLab.getState();
      const dx = e.clientX - d.last[0];
      const dy = e.clientY - d.last[1];
      d.last = [e.clientX, e.clientY];
      st.setView({ pan: [st.view.pan[0] + dx, st.view.pan[1] + dy] });
      return;
    }
    const w = worldOf(e);
    d.onMove([w[0] + d.offset[0], w[1] + d.offset[1]], e);
  };

  const end = (e: PointerEvent) => {
    if (drag.current?.pointer === e.pointerId) {
      drag.current = null;
      setActive(null);
    }
  };

  const wheel = (e: WheelEvent) => {
    const r = svgRect(e);
    const st = useLab.getState();
    st.setView(zoomAt(st.view, [e.clientX - r.left, e.clientY - r.top], Math.exp(-e.deltaY * 0.0015)));
  };

  const ctx: LayerCtx = {
    chart,
    frame: s.frame,
    params: s.params,
    view,
    probe: s.probe,
    toS: (w) => toScreen(view, w),
    begin: (id, e, anchor, onMove) => begin(id, e, anchor, onMove),
    active,
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
      <rect className="pan-surface" width="100%" height="100%" onPointerDown={(e) => begin("pan", e, [0, 0], null)} />
      {s.tool === "metric" && <MetricLayer ctx={ctx} />}
      {SHOW_FRAME[s.tool] && <FrameLayer ctx={ctx} />}
      {s.tool === "length" && <LengthLayer ctx={ctx} />}
      {s.tool === "vector" && <VectorLayer ctx={ctx} />}
      {s.tool === "angle" && <AngleLayer ctx={ctx} />}
      {s.tool === "christoffel" && <ChristoffelLayer ctx={ctx} />}
      {s.tool === "transport" && <TransportLayer ctx={ctx} />}
      {s.tool === "geodesic" && <FanLayer ctx={ctx} />}
      {s.tool === "symbols" && <SymbolsLayer ctx={ctx} />}
    </svg>
  );
}
