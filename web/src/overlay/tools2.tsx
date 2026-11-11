// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Макс
/** Overlay layers of tools 5–9. */
import { useEffect } from "react";
import { localBasis, toWorld } from "../geometry/chart";
import { axisStep } from "../geometry/grid";
import { col, inv, mulV, type V2 } from "../geometry/linalg";
import { splitWrapped } from "../geometry/wrap";
import { inner } from "../numeric/field";
import { orthonormalFrame } from "../numeric/transport";
import { useLab } from "../state/store";
import { probeQ } from "../tools/compute";
import { christoffelInfo, fanInfo, metricAtProbe, transportInfo, worldVec } from "../tools/compute2";
import { COLORS } from "../ui/theme";
import type { LayerCtx, MoveFn } from "./Overlay";
import { Arrow, Grip, Label, Poly } from "./svg";
import { ProbeGrip } from "./tools";

const add = (a: V2, b: V2): V2 => [a[0] + b[0], a[1] + b[1]];
const scl = (a: V2, s: number): V2 => [a[0] * s, a[1] * s];

/** Chart curve → screen polylines (split where periodic coordinates wrap). */
function useCurve(ctx: LayerCtx, qs: V2[]): V2[][] {
  const { chart, frame, params, toS } = ctx;
  return splitWrapped(chart, qs).map((part) => part.map((q) => toS(toWorld(chart, frame, q, params))));
}

// -------------------------------------------------------- 5. Christoffel
export function ChristoffelLayer({ ctx }: { ctx: LayerCtx }) {
  const { chart, frame, params, toS } = ctx;
  const j = useLab((s) => s.christoffelDir);
  const info = christoffelInfo(chart, frame, params, ctx.probe, j);
  if (chart.kind !== "embedded") return null;
  const q = info.q;
  const step = axisStep(chart, j);
  const P = toWorld(chart, frame, q, params);
  const colors = [COLORS.e1, COLORS.e2];
  // the basis along the coordinate line through P in direction j
  const trail = [-4, -3, -2, -1, 1, 2, 3, 4].map((k) => {
    const qq: V2 = [...q];
    qq[j] += (k * step) / 2;
    return { at: toWorld(chart, frame, qq, params), E: localBasis(chart, frame, qq, params) };
  });
  // shift δ along x^j: e_i(P + δ) − e_i(P) ≈ δ Γ^k_{ij} e_k
  const delta = step * 0.8;
  const qd: V2 = [...q];
  qd[j] += delta;
  const Ed = localBasis(chart, frame, qd, params);
  const E = localBasis(chart, frame, q, params);
  const Ps = toS(P);
  return (
    <g>
      {trail.map((t, k) =>
        [0, 1].map((i) => (
          <Arrow
            key={`${k}-${i}`}
            from={toS(t.at)}
            to={toS(add(t.at, scl(col(t.E, i as 0 | 1), 0.5)))}
            color={colors[i]}
            width={1.6}
            glow={false}
            head={8}
            opacity={0.55}
          />
        )),
      )}
      {[0, 1].map((i) => {
        const tipP = add(P, col(E, i as 0 | 1));
        const ghost = add(P, col(Ed, i as 0 | 1));
        const pred = add(tipP, scl(info.predicted[i], delta));
        return (
          <g key={i}>
            <Arrow from={Ps} to={toS(ghost)} color={colors[i]} width={2} dashed glow={false} head={10} opacity={0.75} />
            <Arrow from={toS(tipP)} to={toS(pred)} color="#ffffff" width={2.2} head={10} />
            <Label
              at={add(toS(pred), [8, 16])}
              color="#ffffff"
              text={`δ·∂${j === 0 ? "₁" : "₂"}e${i === 0 ? "₁" : "₂"}`}
              size={13}
              anchor="start"
            />
          </g>
        );
      })}
    </g>
  );
}

// -------------------------------------------------- 6. parallel transport
export function TransportLayer({ ctx }: { ctx: LayerCtx }) {
  const { chart, frame, params, toS } = ctx;
  const kind = useLab((s) => s.loopKind);
  const r = useLab((s) => s.loopR);
  const v0 = useLab((s) => s.transportV0);
  const tAnim = useLab((s) => s.transportT);
  const info = transportInfo(chart, frame, params, ctx.probe, kind, r, v0);
  const loop = useCurve(ctx, info.loop);
  const n = info.steps.length - 1;
  const samples = Array.from({ length: 16 }, (_, k) => info.steps[Math.round((k * n) / 16)]);
  const arrowOf = (st: (typeof info.steps)[number]) => {
    const at = toWorld(chart, frame, st.q, params);
    return { from: toS(at), to: toS(add(at, worldVec(chart, frame, params, st.q, st.v))) };
  };
  const start = arrowOf(info.steps[0]);
  const end = arrowOf(info.steps[n]);
  const startW = toWorld(chart, frame, info.steps[0].q, params);
  const moveV0: MoveFn = (w) => {
    const st = useLab.getState();
    const q0 = info.steps[0].q;
    const d: V2 = [w[0] - startW[0], w[1] - startW[1]];
    const c = mulV(inv(localBasis(chart, st.frame, q0, st.params)), d);
    if (Math.hypot(c[0], c[1]) > 1e-3) st.set({ transportV0: c });
  };
  const live = tAnim === null ? null : arrowOf(info.steps[Math.round(tAnim * n)]);
  // holonomy arc at the start point (drawn between the start and end arrows)
  const a0 = Math.atan2(start.to[1] - start.from[1], start.to[0] - start.from[0]);
  const a1 = Math.atan2(end.to[1] - end.from[1], end.to[0] - end.from[0]);
  let da = a1 - a0;
  while (da > Math.PI) da -= 2 * Math.PI;
  while (da < -Math.PI) da += 2 * Math.PI;
  const R = 26;
  const arc =
    Math.abs(da) > 0.02
      ? `M${start.from[0] + R * Math.cos(a0)} ${start.from[1] + R * Math.sin(a0)} A${R} ${R} 0 0 ${da > 0 ? 1 : 0} ${start.from[0] + R * Math.cos(a1)} ${start.from[1] + R * Math.sin(a1)}`
      : null;

  return (
    <g>
      {loop.map((pts, i) => (
        <Poly key={i} pts={pts} color={COLORS.transport} width={2.4} glow />
      ))}
      {samples.map((st, k) => {
        const a = arrowOf(st);
        return <Arrow key={k} from={a.from} to={a.to} color={COLORS.vec} width={1.6} glow={false} head={8} opacity={tAnim === null ? 0.5 : 0.18} />;
      })}
      <Arrow from={end.from} to={end.to} color={COLORS.transport} width={3} />
      <Arrow from={start.from} to={start.to} color={COLORS.vec} width={3} />
      {arc && <path d={arc} stroke="#fff" strokeWidth={1.4} fill="none" pointerEvents="none" />}
      {live && <Arrow from={live.from} to={live.to} color="#ffffff" width={3.2} />}
      {live && <circle cx={live.from[0]} cy={live.from[1]} r={4} fill="#fff" />}
      <ProbeGrip ctx={ctx} P={toWorld(chart, frame, probeQ(chart, ctx.probe), params)} />
      <Grip at={start.to} onDown={(e) => ctx.begin("v0", e, add(startW, worldVec(chart, frame, params, info.steps[0].q, v0)), moveV0)} />
    </g>
  );
}

/** Animation driver for the transported vector (one lap in 4 s). */
export function useTransportAnimation(playing: boolean) {
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = ((now - t0) / 4000) % 1;
      useLab.getState().set({ transportT: t });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);
}

// --------------------------------------------------------- 7. geodesic fan
export function FanLayer({ ctx }: { ctx: LayerCtx }) {
  const { chart, frame, params, toS } = ctx;
  const alpha = useLab((s) => s.fanAlpha);
  const spread = useLab((s) => s.fanSpread);
  const length = useLab((s) => s.fanLength);
  const info = fanInfo(chart, frame, params, ctx.probe, alpha, spread, length);
  const q = probeQ(chart, ctx.probe);
  const P = toWorld(chart, frame, q, params);
  const g = metricAtProbe(chart, frame, params, ctx.probe);
  const [f1, f2] = orthonormalFrame(g);
  const dirC: V2 = [Math.cos(alpha) * f1[0] + Math.sin(alpha) * f2[0], Math.cos(alpha) * f1[1] + Math.sin(alpha) * f2[1]];
  const handleLen = chart.kind === "abstract" ? 0.25 * Math.min(axisStep(chart, 0), axisStep(chart, 1)) * 4 : 1.2;
  const dirW = worldVec(chart, frame, params, q, dirC);
  const nW = Math.hypot(dirW[0], dirW[1]) || 1;
  const tipW = add(P, scl(dirW, handleLen / nW));
  const mid = (info.rays.length - 1) / 2;
  const move: MoveFn = (w) => {
    const st = useLab.getState();
    const d: V2 = [w[0] - P[0], w[1] - P[1]];
    const c = mulV(inv(localBasis(chart, st.frame, q, st.params)), d);
    st.set({ fanAlpha: Math.atan2(inner(g, c, f2), inner(g, c, f1)) });
  };
  return (
    <g>
      {info.rays.map((ray, k) =>
        splitWrapped(chart, ray.points).map((part, i) => (
          <Poly
            key={`${k}-${i}`}
            pts={part.map((x) => toS(toWorld(chart, frame, x, params)))}
            color={COLORS.geodesic}
            width={k === mid ? 2.6 : 1.4}
            opacity={k === mid ? 1 : 0.55}
            glow={k === mid}
          />
        )),
      )}
      <Arrow from={toS(P)} to={toS(tipW)} color="#ffffff" width={2.4} />
      <ProbeGrip ctx={ctx} P={P} />
      <Grip at={toS(tipW)} onDown={(e) => ctx.begin("fan", e, tipW, move)} />
    </g>
  );
}

// --------------------------------------------------------- 9. δ and ε
export function SymbolsLayer({ ctx }: { ctx: LayerCtx }) {
  const { chart, frame, params, toS } = ctx;
  const [u, w] = useLab((s) => s.angleVecs);
  const P = toWorld(chart, frame, probeQ(chart, ctx.probe), params);
  const quad = [P, add(P, u), add(add(P, u), w), add(P, w)].map(toS);
  const move = (i: 0 | 1): MoveFn => (pt, e) => {
    let d: V2 = [pt[0] - P[0], pt[1] - P[1]];
    if (e.shiftKey) d = [Math.round(d[0] * 4) / 4, Math.round(d[1] * 4) / 4];
    if (Math.hypot(d[0], d[1]) > 0.05) useLab.getState().setAngleVec(i, d);
  };
  const tips = [add(P, u), add(P, w)];
  const signed = u[0] * w[1] - u[1] * w[0];
  return (
    <g>
      <Poly pts={quad} color={signed >= 0 ? COLORS.e1 : COLORS.e2} width={1.4} fill={signed >= 0 ? "rgba(255,200,87,0.13)" : "rgba(255,92,138,0.13)"} />
      {tips.map((t, i) => (
        <g key={i}>
          <Arrow from={toS(P)} to={toS(t)} color={i ? COLORS.vec2 : COLORS.vec} />
          <Label at={add(toS(t), [12, -10])} color={i ? COLORS.vec2 : COLORS.vec} text={i ? "w" : "u"} />
        </g>
      ))}
      <ProbeGrip ctx={ctx} P={P} />
      {tips.map((t, i) => (
        <Grip key={i} at={toS(t)} onDown={(e) => ctx.begin(`sym${i}`, e, t, move(i as 0 | 1))} />
      ))}
    </g>
  );
}
