// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Макс
/**
 * Small 3D view of a surface (orthographic wireframe of its embedding), with
 * the probe point and the curves of the active tool. Drag to rotate.
 */
import { useEffect, useRef } from "react";
import { axisValues } from "../geometry/grid";
import type { V2 } from "../geometry/linalg";
import { uk } from "../i18n/uk";
import { useLab, type LabState } from "../state/store";
import { lengthInfo, probeQ } from "../tools/compute";
import { fanInfo, transportInfo } from "../tools/compute2";
import { COLORS } from "./theme";

type V3 = [number, number, number];
const SIZE = 230;

function toolCurves(s: LabState): { pts: V2[]; color: string; width: number }[] {
  const c = s.chart!;
  const f = s.frame; // same arguments as the overlay, so the memoised results are shared
  switch (s.tool) {
    case "length": {
      const info = lengthInfo(c, f, s.params, s.lengthPts[0], s.lengthPts[1]);
      const [A, B] = s.lengthPts;
      const coord: V2[] = Array.from({ length: 81 }, (_, k) => [A[0] + ((B[0] - A[0]) * k) / 80, A[1] + ((B[1] - A[1]) * k) / 80]);
      return [
        { pts: coord, color: COLORS.coordLine, width: 1.6 },
        ...(info.geo ? [{ pts: info.geo.points, color: COLORS.geodesic, width: 2.2 }] : []),
      ];
    }
    case "transport":
      return [{ pts: transportInfo(c, f, s.params, s.probe, s.loopKind, s.loopR, s.transportV0).loop, color: COLORS.transport, width: 2.2 }];
    case "geodesic":
      return fanInfo(c, f, s.params, s.probe, s.fanAlpha, s.fanSpread, s.fanLength).rays.map((r) => ({
        pts: r.points,
        color: COLORS.geodesic,
        width: 1.2,
      }));
    default:
      return [];
  }
}

export function SurfaceInset() {
  const chart = useLab((s) => s.chart);
  const theoryOpen = useLab((s) => s.theoryOpen);
  const ref = useRef<HTMLCanvasElement>(null);
  const rot = useRef({ az: -0.7, el: 0.45 });
  const drag = useRef<V2 | null>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv || !chart?.surface) return;
    const ctx = cv.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    cv.width = SIZE * dpr;
    cv.height = SIZE * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    let raf = 0;
    let dirty = true;
    const unsub = useLab.subscribe(() => (dirty = true));
    const draw = () => {
      const s = useLab.getState();
      const c = s.chart;
      if (!c?.surface) return;
      const X = (q: V2) => c.surface!(q, s.params);
      const { az, el } = rot.current;
      const [ca, sa, ce, se] = [Math.cos(az), Math.sin(az), Math.cos(el), Math.sin(el)];
      const proj = (p: V3): [number, number, number] => {
        const x = ca * p[0] - sa * p[1];
        const y = sa * p[0] + ca * p[1];
        // view from the side, tilted by the elevation; depth > 0 is towards the viewer
        return [x, ce * p[2] - se * y, ce * y + se * p[2]];
      };
      // wireframe: the same coordinate lines as the 2D map
      const lines: V3[][] = [];
      for (const i of [0, 1] as const) {
        const other = c.display.axes[1 - i];
        for (const v of axisValues(c, i)) {
          const pts: V3[] = [];
          for (let k = 0; k <= 64; k++) {
            const t = other.range[0] + ((other.range[1] - other.range[0]) * k) / 64;
            pts.push(X(i === 0 ? [v, t] : [t, v]));
          }
          lines.push(pts);
        }
      }
      let rmax = 1e-9;
      for (const l of lines) for (const p of l) rmax = Math.max(rmax, Math.hypot(p[0], p[1], p[2]));
      const k = (SIZE * 0.42) / rmax;
      const scr = (p: V3): [number, number, number] => {
        const [x, y, d] = proj(p);
        return [SIZE / 2 + x * k, SIZE / 2 - y * k, d / rmax];
      };
      ctx.clearRect(0, 0, SIZE, SIZE);
      ctx.lineWidth = 1;
      for (const l of lines) {
        for (let j = 1; j < l.length; j++) {
          const a = scr(l[j - 1]);
          const b = scr(l[j]);
          const depth = (a[2] + b[2]) / 2; // −1 back … +1 front
          ctx.strokeStyle = `rgba(91,140,255,${0.12 + 0.4 * (depth + 1) / 2})`;
          ctx.beginPath();
          ctx.moveTo(a[0], a[1]);
          ctx.lineTo(b[0], b[1]);
          ctx.stroke();
        }
      }
      for (const curve of toolCurves(s)) {
        ctx.strokeStyle = curve.color;
        ctx.lineWidth = curve.width;
        ctx.beginPath();
        curve.pts.forEach((q, j) => {
          const p = scr(X(q));
          if (j) ctx.lineTo(p[0], p[1]);
          else ctx.moveTo(p[0], p[1]);
        });
        ctx.stroke();
      }
      const P = scr(X(probeQ(c, s.probe)));
      ctx.fillStyle = COLORS.probe;
      ctx.beginPath();
      ctx.arc(P[0], P[1], 4, 0, 2 * Math.PI);
      ctx.fill();
    };
    const loop = () => {
      if (dirty) {
        draw();
        dirty = false;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const onDown = (e: PointerEvent) => {
      drag.current = [e.clientX, e.clientY];
      cv.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!drag.current) return;
      rot.current.az += (e.clientX - drag.current[0]) * 0.01;
      rot.current.el = Math.max(-1.4, Math.min(1.4, rot.current.el + (e.clientY - drag.current[1]) * 0.01));
      drag.current = [e.clientX, e.clientY];
      dirty = true;
    };
    const onUp = () => (drag.current = null);
    cv.addEventListener("pointerdown", onDown);
    cv.addEventListener("pointermove", onMove);
    cv.addEventListener("pointerup", onUp);
    return () => {
      cancelAnimationFrame(raf);
      unsub();
      cv.removeEventListener("pointerdown", onDown);
      cv.removeEventListener("pointermove", onMove);
      cv.removeEventListener("pointerup", onUp);
    };
  }, [chart]);

  if (!chart?.surface) return null;
  return (
    <div className={`inset${theoryOpen ? " shifted" : ""}`}>
      <canvas ref={ref} style={{ width: SIZE, height: SIZE }} />
      <span className="inset-label">{uk.panel.inset}</span>
    </div>
  );
}
