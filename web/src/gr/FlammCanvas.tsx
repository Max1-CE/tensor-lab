// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Макс
/**
 * Flamm's paraboloid drawn with Canvas 2D: shaded quads in painter's order
 * (far to near), so grid lines and rings are hidden behind the funnel properly.
 * Drag to rotate; hover/click a ring to open its theory card.
 */
import { useEffect, useRef } from "react";
import { useLab } from "../state/store";
import { SCHWARZSCHILD as ST } from "./spacetime";
import { R_MAX, useGR, type GRElement } from "./store";

type V3 = [number, number, number];
interface Item {
  depth: number;
  draw: (ctx: CanvasRenderingContext2D) => void;
}

const NR = 40;
const NPHI = 72;
const LIGHT: V3 = (() => {
  const l: V3 = [-0.45, -0.55, 0.7];
  const n = Math.hypot(...l);
  return [l[0] / n, l[1] / n, l[2] / n];
})();

/** Ring hit-test data from the last frame (screen polylines). */
let ringHits: { id: GRElement; pts: [number, number][] }[] = [];

function render(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const s = useGR.getState();
  const M = s.shownM;
  const rMin = ST.rMin(M);
  const zTop = ST.embeddingZ(R_MAX, M);
  const sheets = s.show.secondSheet ? [1, -1] : [1];
  const zMid = s.show.secondSheet ? 0 : zTop / 2;
  const [ca, sa, ce, se] = [Math.cos(s.az), Math.sin(s.az), Math.cos(s.el), Math.sin(s.el)];
  const vertExtent = s.show.secondSheet ? zTop : zTop / 2;
  const k = Math.min(W / (2.25 * R_MAX), H / (2 * (R_MAX * se + vertExtent * ce) + 40));
  const cx = W / 2;
  const cy = H / 2 + 10;
  const proj = (p: V3): [number, number, number] => {
    const x = ca * p[0] - sa * p[1];
    const y = sa * p[0] + ca * p[1];
    const z = p[2] - zMid;
    return [cx + k * x, cy - k * (ce * z - se * y), ce * y + se * z];
  };
  const P = (r: number, phi: number, sheet: number): V3 => [r * Math.cos(phi), r * Math.sin(phi), sheet * ST.embeddingZ(r, M)];
  const rAt = (i: number) => rMin + (R_MAX - rMin) * (i / NR) ** 1.6;

  const items: Item[] = [];
  // ---------------------------------------------------------------- surface
  for (const sheet of sheets) {
    for (let i = 0; i < NR; i++) {
      const r0 = rAt(i);
      const r1 = rAt(i + 1);
      const rm = (r0 + r1) / 2;
      const slope = Math.sqrt((2 * M) / Math.max(1e-9, rm - 2 * M)); // dz/dr
      for (let j = 0; j < NPHI; j++) {
        const p0 = (2 * Math.PI * j) / NPHI;
        const p1 = (2 * Math.PI * (j + 1)) / NPHI;
        const pm = (p0 + p1) / 2;
        const corners = [P(r0, p0, sheet), P(r1, p0, sheet), P(r1, p1, sheet), P(r0, p1, sheet)].map(proj);
        const depth = corners.reduce((a, c) => a + c[2], 0) / 4;
        // outward-up normal of the surface of revolution
        const n: V3 = [-slope * Math.cos(pm) * sheet, -slope * Math.sin(pm) * sheet, 1];
        const nl = Math.hypot(...n);
        const lam = Math.max(0, (n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]) / nl);
        const b = 0.22 + 0.55 * lam;
        const fill = `rgb(${Math.round(8 + 22 * b)},${Math.round(16 + 50 * b)},${Math.round(40 + 120 * b)})`;
        const radialLine = (i + 1) % 4 === 0;
        const ringLine = j % 6 === 0;
        items.push({
          depth,
          draw: (c) => {
            c.beginPath();
            c.moveTo(corners[0][0], corners[0][1]);
            for (let q = 1; q < 4; q++) c.lineTo(corners[q][0], corners[q][1]);
            c.closePath();
            c.fillStyle = fill;
            c.strokeStyle = fill;
            c.lineWidth = 0.7;
            c.fill();
            c.stroke();
            c.strokeStyle = "rgba(110,160,255,0.55)";
            c.lineWidth = 1;
            if (radialLine) {
              // circle r = const (outer edge of this quad)
              c.beginPath();
              c.moveTo(corners[1][0], corners[1][1]);
              c.lineTo(corners[2][0], corners[2][1]);
              c.stroke();
            }
            if (ringLine) {
              // radial line φ = const
              c.beginPath();
              c.moveTo(corners[0][0], corners[0][1]);
              c.lineTo(corners[1][0], corners[1][1]);
              c.stroke();
            }
          },
        });
      }
    }
  }

  // ------------------------------------------------------------------ rings
  const rings: { id: GRElement; r: number; color: string; label: string; dash?: number[] }[] = [];
  for (const rad of ST.radii) {
    const id = rad.id as GRElement;
    if (s.show[id as "horizon" | "photon" | "isco"]) rings.push({ id, r: rad.r(M), color: rad.color, label: `r = ${rad.label}` });
  }
  if (s.show.probe) rings.push({ id: "probe", r: Math.min(R_MAX, s.probeX * M), color: "#ffffff", label: "P", dash: [6, 5] });

  ringHits = [];
  for (const ring of rings) {
    const pts = Array.from({ length: 145 }, (_, j) => proj(P(ring.r, (2 * Math.PI * j) / 144, 1)));
    ringHits.push({ id: ring.id, pts: pts.map((p) => [p[0], p[1]]) });
    const active = s.hover === ring.id || s.selected === ring.id;
    for (let j = 0; j < 144; j++) {
      const a = pts[j];
      const b = pts[j + 1];
      items.push({
        // lies on the surface: bias it above the neighbouring quads (whose depths
        // differ by up to ~half a cell), but far less than the funnel's thickness
        depth: (a[2] + b[2]) / 2 + 0.8,
        draw: (c) => {
          c.strokeStyle = ring.color;
          c.lineWidth = active ? 3.6 : 2.4;
          c.setLineDash(ring.dash ?? []);
          c.shadowColor = ring.color;
          c.shadowBlur = active ? 12 : 6;
          c.beginPath();
          c.moveTo(a[0], a[1]);
          c.lineTo(b[0], b[1]);
          c.stroke();
          c.shadowBlur = 0;
          c.setLineDash([]);
        },
      });
    }
    // label at the front-most point
    const front = pts.reduce((best, p) => (p[2] > best[2] ? p : best));
    items.push({
      depth: front[2] + 10,
      draw: (c) => {
        c.font = "italic 15px KaTeX_Math, 'Times New Roman', serif";
        c.fillStyle = ring.color;
        c.textAlign = "left";
        c.fillText(ring.label, front[0] + 10, front[1] + 18);
        if (ring.id === "probe") {
          c.beginPath();
          c.arc(front[0], front[1], 5, 0, 2 * Math.PI);
          c.fill();
        }
      },
    });
  }

  ctx.clearRect(0, 0, W, H);
  items.sort((a, b) => a.depth - b.depth);
  for (const it of items) it.draw(ctx);
}

function hitRing(x: number, y: number): GRElement | null {
  let best: GRElement | null = null;
  let bestD = 10;
  for (const h of ringHits) {
    for (let j = 1; j < h.pts.length; j++) {
      const [ax, ay] = h.pts[j - 1];
      const [bx, by] = h.pts[j];
      const dx = bx - ax;
      const dy = by - ay;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
      const d = Math.hypot(x - ax - t * dx, y - ay - t * dy);
      if (d < bestD) {
        bestD = d;
        best = h.id;
      }
    }
  }
  return best;
}

export function FlammCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current!;
    const ctx = cv.getContext("2d")!;
    let W = 1;
    let H = 1;
    let dirty = true;
    const unsub = useGR.subscribe(() => (dirty = true));
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      W = cv.clientWidth;
      H = cv.clientHeight;
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dirty = true;
    };
    const ro = new ResizeObserver(resize);
    ro.observe(cv);
    resize();

    let raf = 0;
    const loop = () => {
      const s = useGR.getState();
      // ease the displayed mass towards the slider value (smooth morph)
      if (Math.abs(s.shownM - s.M) > 1e-4) s.set({ shownM: s.shownM + (s.M - s.shownM) * 0.18 });
      else if (s.shownM !== s.M) s.set({ shownM: s.M });
      if (dirty) {
        render(ctx, W, H);
        dirty = false;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    let down: { x: number; y: number; moved: boolean } | null = null;
    const local = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top] as const;
    };
    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY, moved: false };
      cv.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      const s = useGR.getState();
      if (down) {
        const dx = e.clientX - down.x;
        const dy = e.clientY - down.y;
        if (Math.abs(dx) + Math.abs(dy) > 2) down.moved = true;
        s.set({ az: s.az + dx * 0.008, el: Math.max(0.05, Math.min(1.45, s.el + dy * 0.006)) });
        down.x = e.clientX;
        down.y = e.clientY;
        return;
      }
      const [x, y] = local(e);
      const h = hitRing(x, y);
      if (h !== s.hover) s.set({ hover: h });
      cv.style.cursor = h ? "pointer" : "grab";
    };
    const onUp = (e: PointerEvent) => {
      if (down && !down.moved) {
        const [x, y] = local(e);
        const h = hitRing(x, y) ?? "flamm";
        useGR.getState().set({ selected: h });
        useLab.getState().toggleTheory(true);
      }
      down = null;
    };
    cv.addEventListener("pointerdown", onDown);
    cv.addEventListener("pointermove", onMove);
    cv.addEventListener("pointerup", onUp);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      unsub();
      cv.removeEventListener("pointerdown", onDown);
      cv.removeEventListener("pointermove", onMove);
      cv.removeEventListener("pointerup", onUp);
    };
  }, []);

  return <canvas ref={ref} className="layer flamm" />;
}
