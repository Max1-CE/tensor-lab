// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Макс
/** Canvas layer: coordinate lines, lines through P, basis field, indicatrices. */
import { useEffect, useRef } from "react";
import { coordinateLine, axisValues, type Line } from "../geometry/grid";
import { localBasis, toWorld } from "../geometry/chart";
import { norm, symEig, type M2, type V2 } from "../geometry/linalg";
import { toScreen, type Viewport } from "../geometry/viewport";
import { currentLines, MORPH_MS, useLab, type LabState } from "../state/store";
import { COLORS, rgba } from "../ui/theme";

function tracePath(path: Path2D, line: Line, v: Viewport): void {
  const jump = Math.max(v.width, v.height);
  let pen = false;
  let px = 0;
  let py = 0;
  for (let k = 0; k < line.length; k += 2) {
    const x = v.width / 2 + v.pan[0] + line[k] * v.scale;
    const y = v.height / 2 + v.pan[1] - line[k + 1] * v.scale;
    if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > 1e5 || Math.abs(y) > 1e5) {
      pen = false;
      continue;
    }
    if (pen && Math.hypot(x - px, y - py) < jump) path.lineTo(x, y);
    else path.moveTo(x, y);
    pen = true;
    px = x;
    py = y;
  }
}

function arrow(ctx: CanvasRenderingContext2D, from: V2, to: V2, color: string, width: number, head: number): void {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const len = Math.hypot(dx, dy);
  if (len < 2) return;
  const ux = dx / len;
  const uy = dy / len;
  const h = Math.min(head, len * 0.45);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(from[0], from[1]);
  ctx.lineTo(to[0] - ux * h * 0.8, to[1] - uy * h * 0.8);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(to[0], to[1]);
  ctx.lineTo(to[0] - ux * h - uy * h * 0.45, to[1] - uy * h + ux * h * 0.45);
  ctx.lineTo(to[0] - ux * h + uy * h * 0.45, to[1] - uy * h - ux * h * 0.45);
  ctx.closePath();
  ctx.fill();
}

const stepOf = (vals: number[]) => (vals.length > 1 ? vals[1] - vals[0] : 1);

function draw(ctx: CanvasRenderingContext2D, s: LabState, now: number): void {
  const v = s.view;
  ctx.clearRect(0, 0, v.width, v.height);
  const chart = s.chart;
  const lines = currentLines(s, now);
  if (!chart || !lines) return;
  const morphing = !!s.morph && now - s.morph.start < MORPH_MS;
  const fam = [COLORS.family0, COLORS.family1];
  const values = [axisValues(chart, 0), axisValues(chart, 1)];

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const f of [0, 1] as const) {
    const thin = new Path2D();
    const axis = new Path2D();
    lines[f].forEach((line, j) => {
      const isAxis = !morphing && Math.abs(values[f][j] ?? NaN) < 1e-9;
      tracePath(isAxis ? axis : thin, line, v);
    });
    ctx.strokeStyle = rgba(fam[f], 0.32);
    ctx.lineWidth = 1;
    ctx.stroke(thin);
    ctx.strokeStyle = rgba(fam[f], 0.85);
    ctx.lineWidth = 1.6;
    ctx.stroke(axis);
  }
  if (morphing) return;

  const p = s.params;
  const q = s.probe;
  // Coordinate lines through P: the line q² = P² is tangent to e₁ and vice versa.
  const along1 = new Path2D();
  const along2 = new Path2D();
  tracePath(along1, coordinateLine(chart, s.frame, p, 1, q[1]), v);
  tracePath(along2, coordinateLine(chart, s.frame, p, 0, q[0]), v);
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = COLORS.e1 + "70";
  ctx.stroke(along1);
  ctx.strokeStyle = COLORS.e2 + "70";
  ctx.stroke(along2);

  const nodes0 = values[0].filter((_, k) => k % 2 === 0);
  const nodes1 = values[1].filter((_, k) => k % 2 === 0);
  const d0 = stepOf(values[0]);
  const d1 = stepOf(values[1]);

  if (s.showField && chart.kind === "embedded") {
    for (const a of nodes0) {
      for (const b of nodes1) {
        const node: V2 = [a, b];
        let E: M2;
        try {
          E = localBasis(chart, s.frame, node, p);
        } catch {
          continue;
        }
        // skip coordinate singularities (e.g. the pole r = 0), where the basis degenerates
        if (Math.abs(E[0] * E[3] - E[1] * E[2]) < 1e-6) continue;
        const base = toScreen(v, toWorld(chart, s.frame, node, p));
        const k = 0.42;
        const t1: V2 = [base[0] + k * d0 * E[0] * v.scale, base[1] - k * d0 * E[2] * v.scale];
        const t2: V2 = [base[0] + k * d1 * E[1] * v.scale, base[1] - k * d1 * E[3] * v.scale];
        if (norm([E[0], E[2]]) > 1e-6) arrow(ctx, base, t1, COLORS.e1 + "b0", 1.3, 6);
        if (norm([E[1], E[3]]) > 1e-6) arrow(ctx, base, t2, COLORS.e2 + "b0", 1.3, 6);
      }
    }
  }

  if (chart.kind === "abstract") {
    // Indicatrix: the set g_ij dq^i dq^j = ε² drawn in the coordinate plane.
    const eps = 0.36 * Math.min(Math.abs(d0), Math.abs(d1));
    const cap = 0.48 * Math.max(Math.abs(d0), Math.abs(d1));
    ctx.strokeStyle = rgba(COLORS.indicatrix, 0.55);
    ctx.fillStyle = rgba(COLORS.indicatrix, 0.06);
    ctx.lineWidth = 1.1;
    for (const a of nodes0) {
      for (const b of nodes1) {
        const g = chart.metricFn([a, b], p) as M2;
        if (!g.every(Number.isFinite)) continue;
        const { values: lam, vectors } = symEig(g);
        if (lam[0] <= 1e-9) continue;
        const r1 = Math.min(cap, eps / Math.sqrt(lam[0])) * v.scale;
        const r2 = Math.min(cap, eps / Math.sqrt(lam[1])) * v.scale;
        const c = toScreen(v, toWorld(chart, s.frame, [a, b], p));
        const ang = -Math.atan2(vectors[0][1], vectors[0][0]);
        ctx.beginPath();
        ctx.ellipse(c[0], c[1], r1, r2, ang, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
      }
    }
  }
}

export function GridLayer() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current!;
    const ctx = cv.getContext("2d")!;
    let dirty = true;
    let wasMorphing = false;
    const unsub = useLab.subscribe(() => {
      dirty = true;
    });
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = cv.clientWidth;
      const h = cv.clientHeight;
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      useLab.getState().setView({ width: w, height: h });
      dirty = true;
    };
    const ro = new ResizeObserver(resize);
    ro.observe(cv);
    resize();

    let raf = 0;
    const loop = (now: number) => {
      const s = useLab.getState();
      const morphing = !!s.morph && now - s.morph.start < MORPH_MS;
      if (dirty || morphing || wasMorphing) {
        draw(ctx, s, now);
        dirty = false;
      }
      wasMorphing = morphing;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      unsub();
    };
  }, []);

  return <canvas ref={ref} className="layer grid-layer" />;
}
