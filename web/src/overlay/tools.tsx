// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Макс
/** Overlay layers of tools 1–4: metric cell, curve length, vector components, angle. */
import { fromWorld, toWorld } from "../geometry/chart";
import { axisStep } from "../geometry/grid";
import { col, type V2 } from "../geometry/linalg";
import { useLab } from "../state/store";
import { angleInfo, lengthInfo, metricInfo, probeQ, vectorInfo } from "../tools/compute";
import { COLORS } from "../ui/theme";
import type { LayerCtx, MoveFn } from "./Overlay";
import { Arrow, Grip, Label, Poly, Seg } from "./svg";

const add = (a: V2, b: V2): V2 => [a[0] + b[0], a[1] + b[1]];
const scl = (a: V2, s: number): V2 => [a[0] * s, a[1] * s];

/** Offset a label outward from `base` along the direction to `tip` (screen px). */
function labelAt(base: V2, tip: V2, along = 16, side = 10): V2 {
  const dx = tip[0] - base[0];
  const dy = tip[1] - base[1];
  const l = Math.hypot(dx, dy) || 1;
  return [tip[0] + (dx / l) * along - (dy / l) * side, tip[1] + (dy / l) * along + (dx / l) * side];
}

/** Probe handle used by tools that hide the basis frame. */
export function ProbeGrip({ ctx, P }: { ctx: LayerCtx; P: V2 }) {
  if (ctx.chart.display.affine) return null;
  const move: MoveFn = (w) => {
    const st = useLab.getState();
    st.setProbe(fromWorld(ctx.chart, st.frame, w, st.probe, st.params));
  };
  return <Grip at={ctx.toS(P)} dot={5.5} color={COLORS.probe} label="P" r={14} onDown={(e) => ctx.begin("probe", e, P, move)} />;
}

// --------------------------------------------------------------- 1. metric
export function MetricLayer({ ctx }: { ctx: LayerCtx }) {
  const { chart, frame, params, toS } = ctx;
  const frac = useLab((s) => s.cellFrac);
  const info = metricInfo(chart, frame, params, ctx.probe, frac, axisStep(chart, 0), axisStep(chart, 1));
  const [q0, q1] = info.q;
  const [d0, d1] = info.cell.d;
  const n = 24;
  const boundary: V2[] = [];
  const edge = (from: V2, to: V2) => {
    for (let k = 0; k < n; k++) {
      const t = k / n;
      boundary.push(toS(toWorld(chart, frame, [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t], params)));
    }
  };
  const c = [
    [q0, q1],
    [q0 + d0, q1],
    [q0 + d0, q1 + d1],
    [q0, q1 + d1],
  ] as V2[];
  c.forEach((p, i) => edge(p, c[(i + 1) % 4]));

  const P = toWorld(chart, frame, info.q, params);
  // tangent parallelogram spanned by dx¹e₁ and dx²e₂ at P
  const basis = vectorInfo(chart, frame, params, ctx.probe, [1, 0]).E;
  const h1 = scl(col(basis, 0), d0);
  const h2 = scl(col(basis, 1), d1);
  const para = [P, add(P, h1), add(add(P, h1), h2), add(P, h2)].map(toS);

  return (
    <g>
      <Poly pts={boundary} color={COLORS.cell} width={1.6} fill="rgba(94,234,212,0.14)" />
      <Poly pts={para} color="#ffffff" width={1.2} dash="5 4" fill="none" opacity={0.85} />
    </g>
  );
}

// --------------------------------------------------------------- 2. length
export function LengthLayer({ ctx }: { ctx: LayerCtx }) {
  const { chart, frame, params, toS } = ctx;
  const [A, B] = useLab((s) => s.lengthPts);
  const info = lengthInfo(chart, frame, params, A, B);
  const coordPath: V2[] = [];
  for (let k = 0; k <= 160; k++) {
    const t = k / 160;
    coordPath.push(toS(toWorld(chart, frame, [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t], params)));
  }
  const geoPath = info.geo ? info.geo.points.map((q) => toS(toWorld(chart, frame, q, params))) : [];
  const steps: V2 = [axisStep(chart, 0) / 2, axisStep(chart, 1) / 2];
  const drag = (i: 0 | 1): MoveFn => (w, e) => {
    const st = useLab.getState();
    let q = fromWorld(chart, st.frame, w, st.lengthPts[i], st.params);
    if (e.shiftKey) q = [Math.round(q[0] / steps[0]) * steps[0], Math.round(q[1] / steps[1]) * steps[1]];
    st.setLengthPt(i, q);
  };
  const pts = [A, B].map((q) => toWorld(chart, frame, q, params));
  return (
    <g>
      <Poly pts={coordPath} color={COLORS.coordLine} width={2.6} glow />
      {geoPath.length > 1 && <Poly pts={geoPath} color={COLORS.geodesic} width={2.6} dash="9 6" glow />}
      {pts.map((w, i) => (
        <Grip
          key={i}
          at={toS(w)}
          dot={6}
          color="#ffffff"
          label={i ? "B" : "A"}
          onDown={(e) => ctx.begin(`len${i}`, e, w, drag(i as 0 | 1))}
        />
      ))}
    </g>
  );
}

// --------------------------------------------------------------- 3. vector
export function VectorLayer({ ctx }: { ctx: LayerCtx }) {
  const { chart, frame, params, toS } = ctx;
  const v = useLab((s) => s.vec);
  const showDual = useLab((s) => s.showDual);
  const info = vectorInfo(chart, frame, params, ctx.probe, v);
  const P = info.P;
  const tip = add(P, v);
  const Ps = toS(P);
  const Ts = toS(tip);
  const e1 = col(info.E, 0);
  const e2 = col(info.E, 1);
  const a1 = add(P, scl(e1, info.up[0])); // P + v¹e₁
  const a2 = add(P, scl(e2, info.up[1])); // P + v²e₂
  const embedded = chart.kind === "embedded";

  const d1 = col(info.Edual, 0);
  const d2 = col(info.Edual, 1);
  const b1 = add(P, scl(d1, info.down[0])); // P + v₁e¹
  const b2 = add(P, scl(d2, info.down[1]));
  // orthogonal projections of v onto the lines of e_i: (v_i / |e_i|²) e_i
  const foot = (e: V2, vi: number): V2 => add(P, scl(e, vi / (e[0] * e[0] + e[1] * e[1])));

  const move: MoveFn = (w, e) => {
    const st = useLab.getState();
    let d: V2 = [w[0] - info.P[0], w[1] - info.P[1]];
    if (e.shiftKey) {
      // snap the contravariant components to quarters
      const up = vectorInfo(chart, st.frame, st.params, st.probe, d).up;
      const s: V2 = [Math.round(up[0] * 4) / 4, Math.round(up[1] * 4) / 4];
      d = add(scl(e1, s[0]), scl(e2, s[1]));
    }
    if (Math.hypot(d[0], d[1]) > 1e-3) st.setVec(d);
  };

  return (
    <g>
      {/* contravariant decomposition: v = v¹e₁ + v²e₂ (parallelogram) */}
      <Arrow from={Ps} to={toS(a1)} color={COLORS.e1} width={2} dashed glow={false} head={11} opacity={0.9} />
      <Arrow from={Ps} to={toS(a2)} color={COLORS.e2} width={2} dashed glow={false} head={11} opacity={0.9} />
      <Seg a={toS(a1)} b={Ts} color={COLORS.e2} opacity={0.5} />
      <Seg a={toS(a2)} b={Ts} color={COLORS.e1} opacity={0.5} />
      <Label at={labelAt(Ps, toS(a1), 10, 14)} color={COLORS.e1} text="v" sup="1" sub=" " size={15} />
      <Label at={labelAt(Ps, toS(a2), 10, -14)} color={COLORS.e2} text="v" sup="2" sub=" " size={15} />

      {showDual && embedded && (
        <g>
          {/* dual basis e^i and covariant decomposition v = v₁e¹ + v₂e² */}
          <Arrow from={Ps} to={toS(add(P, d1))} color={COLORS.dual1} width={2} glow={false} head={11} />
          <Arrow from={Ps} to={toS(add(P, d2))} color={COLORS.dual2} width={2} glow={false} head={11} />
          <Label at={labelAt(Ps, toS(add(P, d1)), 14, -8)} color={COLORS.dual1} text="e" sup="1" size={15} />
          <Label at={labelAt(Ps, toS(add(P, d2)), 14, 8)} color={COLORS.dual2} text="e" sup="2" size={15} />
          <Seg a={toS(b1)} b={Ts} color={COLORS.dual2} opacity={0.45} dash="2 4" />
          <Seg a={toS(b2)} b={Ts} color={COLORS.dual1} opacity={0.45} dash="2 4" />
          {/* perpendicular drops: their feet sit at v_i/|e_i|² along e_i */}
          <Seg a={Ts} b={toS(foot(e1, info.down[0]))} color="#ffffff" opacity={0.35} dash="1 4" />
          <Seg a={Ts} b={toS(foot(e2, info.down[1]))} color="#ffffff" opacity={0.35} dash="1 4" />
          <circle cx={toS(foot(e1, info.down[0]))[0]} cy={toS(foot(e1, info.down[0]))[1]} r={3} fill={COLORS.dual1} />
          <circle cx={toS(foot(e2, info.down[1]))[0]} cy={toS(foot(e2, info.down[1]))[1]} r={3} fill={COLORS.dual2} />
        </g>
      )}

      <Arrow from={Ps} to={Ts} color={COLORS.vec} width={3.2} />
      <Label at={labelAt(Ps, Ts)} color={COLORS.vec} text="v" />
      <Grip at={Ts} onDown={(e) => ctx.begin("vec", e, tip, move)} />
    </g>
  );
}

// ---------------------------------------------------------------- 4. angle
export function AngleLayer({ ctx }: { ctx: LayerCtx }) {
  const { chart, frame, params, toS } = ctx;
  const [u, w] = useLab((s) => s.angleVecs);
  const info = angleInfo(chart, frame, params, ctx.probe, u, w);
  const P = toWorld(chart, frame, probeQ(chart, ctx.probe), params);
  const Ps = toS(P);
  const tips = [add(P, u), add(P, w)];
  const ts = tips.map(toS);
  const colors = [COLORS.vec, COLORS.vec2];

  // arc of the drawn angle, the short way round
  const r = 40;
  const a0 = Math.atan2(ts[0][1] - Ps[1], ts[0][0] - Ps[0]);
  let da = Math.atan2(ts[1][1] - Ps[1], ts[1][0] - Ps[0]) - a0;
  while (da > Math.PI) da -= 2 * Math.PI;
  while (da < -Math.PI) da += 2 * Math.PI;
  const arcEnd: V2 = [Ps[0] + r * Math.cos(a0 + da), Ps[1] + r * Math.sin(a0 + da)];
  const arcStart: V2 = [Ps[0] + r * Math.cos(a0), Ps[1] + r * Math.sin(a0)];
  const mid = a0 + da / 2;
  const lab: V2 = [Ps[0] + (r + 34) * Math.cos(mid), Ps[1] + (r + 34) * Math.sin(mid)];
  const deg = (info.angle * 180) / Math.PI;

  const move = (i: 0 | 1): MoveFn => (wpt, e) => {
    let d: V2 = [wpt[0] - P[0], wpt[1] - P[1]];
    if (e.shiftKey) d = [Math.round(d[0] * 4) / 4, Math.round(d[1] * 4) / 4];
    if (Math.hypot(d[0], d[1]) > 0.05) useLab.getState().setAngleVec(i, d);
  };

  return (
    <g>
      <path
        d={`M${Ps[0]} ${Ps[1]} L${arcStart[0]} ${arcStart[1]} A${r} ${r} 0 0 ${da > 0 ? 1 : 0} ${arcEnd[0]} ${arcEnd[1]} Z`}
        fill="rgba(255,255,255,0.08)"
        stroke="rgba(255,255,255,0.7)"
        strokeWidth={1.4}
        pointerEvents="none"
      />
      <Label at={lab} color="#ffffff" text={`θ = ${deg.toFixed(1)}°`} size={14} />
      {ts.map((t, i) => (
        <g key={i}>
          <Arrow from={Ps} to={t} color={colors[i]} />
          <Label at={labelAt(Ps, t)} color={colors[i]} text={i ? "w" : "u"} />
        </g>
      ))}
      <ProbeGrip ctx={ctx} P={P} />
      {ts.map((t, i) => (
        <Grip key={i} at={t} onDown={(e) => ctx.begin(`ang${i}`, e, tips[i], move(i as 0 | 1))} />
      ))}
    </g>
  );
}
