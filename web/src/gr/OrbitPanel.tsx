// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Макс
/** Orbit module panel: turning points, playback, precession numbers and the V_eff(r) plot. */
import { useState } from "react";
import { useLab } from "../state/store";
import { fmt } from "../ui/MetricPanel";
import { Tex } from "../ui/Tex";
import { effectivePotential, mercuryArcsecPerCentury, minPeriapsis } from "./orbits";
import { orbitView, rAt } from "./orbitTrack";
import { SCHWARZSCHILD as ST, SUN_KM } from "./spacetime";
import { R_MAX, useGR, VIEW_3D, VIEW_TOP, type GRElement } from "./store";

const deg = (rad: number) => (rad * 180) / Math.PI;
const MERCURY_ARCSEC = mercuryArcsecPerCentury(SUN_KM);

function VeffPlot({ M, L, E2, rp, ra, rNow, onPick }: {
  M: number; L: number; E2: number; rp: number; ra: number; rNow: number; onPick: () => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 296;
  const H = 150;
  const pad = { l: 34, r: 8, t: 10, b: 22 };
  const r0 = 2 * M;
  const r1 = R_MAX;
  const n = 220;
  const rs = Array.from({ length: n + 1 }, (_, i) => r0 + ((r1 - r0) * i) / n);
  const V = rs.map((r) => effectivePotential(r, L, M));
  const Vmin = Math.min(...V.filter((_, i) => rs[i] > 4 * M));
  const gap = Math.max(E2 - Vmin, 0.004);
  const yLo = Vmin - 0.25 * gap;
  // include the top of the centrifugal barrier when it is not far above E²
  const Vpeak = Math.max(...V.filter((_, i) => rs[i] > 3 * M && rs[i] < 6 * M), -Infinity);
  const yHi = Vpeak - E2 < 4 * gap ? Math.max(E2 + 1.3 * gap, Vpeak + 0.2 * gap) : E2 + 1.3 * gap;
  const X = (r: number) => pad.l + ((W - pad.l - pad.r) * (r - r0)) / (r1 - r0);
  // values outside [yLo, yHi] leave the plot through the clip path instead of being flattened
  const Y = (v: number) => pad.t + ((H - pad.t - pad.b) * (yHi - Math.max(yLo - 10 * (yHi - yLo), Math.min(yHi + 10 * (yHi - yLo), v)))) / (yHi - yLo);
  const curve = rs.map((r, i) => `${i ? "L" : "M"}${X(r).toFixed(1)} ${Y(V[i]).toFixed(1)}`).join("");
  // allowed region: between the curve and E² for r ∈ [rp, ra]
  const inside = rs.filter((r) => r >= rp && r <= ra);
  const shade =
    inside.length > 1
      ? `M${X(rp)} ${Y(E2)} ` + inside.map((r) => `L${X(r).toFixed(1)} ${Y(effectivePotential(r, L, M)).toFixed(1)}`).join(" ") + ` L${X(ra)} ${Y(E2)} Z`
      : "";
  const hr = hover === null ? null : rs[hover];
  return (
    <svg
      className="spark veff"
      width={W}
      height={H}
      onClick={onPick}
      onMouseMove={(e) => {
        const b = e.currentTarget.getBoundingClientRect();
        const r = r0 + ((e.clientX - b.left - pad.l) / (W - pad.l - pad.r)) * (r1 - r0);
        setHover(Math.max(0, Math.min(n, Math.round(((r - r0) / (r1 - r0)) * n))));
      }}
      onMouseLeave={() => setHover(null)}
    >
      <defs>
        <clipPath id="veff-clip">
          <rect x={pad.l} y={pad.t} width={W - pad.l - pad.r} height={H - pad.t - pad.b} />
        </clipPath>
      </defs>
      <line x1={pad.l} y1={H - pad.b} x2={W - pad.r} y2={H - pad.b} className="axis" />
      <line x1={pad.l} y1={pad.t} x2={pad.l} y2={H - pad.b} className="axis" />
      <g clipPath="url(#veff-clip)">
      {ST.radii.map((rad) => (
        <line key={rad.id} x1={X(rad.r(M))} x2={X(rad.r(M))} y1={pad.t} y2={H - pad.b} stroke={rad.color} strokeDasharray="3 4" opacity={0.6} />
      ))}
      {shade && <path d={shade} fill="rgba(125,249,255,0.16)" />}
      <path d={curve} stroke="#dfe6ff" strokeWidth={1.8} fill="none" />
      </g>
      <line x1={pad.l} x2={W - pad.r} y1={Y(E2)} y2={Y(E2)} stroke="#ff9f43" strokeWidth={1.6} />
      <text x={W - pad.r - 2} y={Y(E2) - 4} className="tick" textAnchor="end" fill="#ff9f43">E²</text>
      {[rp, ra].map((r, i) => (
        <circle key={i} cx={X(r)} cy={Y(E2)} r={3} fill="#ff9f43" />
      ))}
      <circle cx={X(rNow)} cy={Y(E2)} r={5} fill="#ffffff" stroke="#7df9ff" strokeWidth={2} />
      <text x={pad.l - 4} y={pad.t + 8} className="tick" textAnchor="end">{yHi.toFixed(3)}</text>
      <text x={pad.l - 4} y={H - pad.b} className="tick" textAnchor="end">{yLo.toFixed(3)}</text>
      <text x={X(r0)} y={H - 6} className="tick">2M</text>
      <text x={W - pad.r} y={H - 6} className="tick" textAnchor="end">r = {R_MAX}</text>
      {hr !== null && (
        <g>
          <line x1={X(hr)} x2={X(hr)} y1={pad.t} y2={H - pad.b} className="cross" />
          <text x={Math.min(X(hr) + 6, W - 120)} y={pad.t + 12} className="tip">
            r = {(hr / M).toFixed(2)}M, V = {effectivePotential(hr, L, M).toFixed(4)}
          </text>
        </g>
      )}
    </svg>
  );
}

export function OrbitPanel() {
  const M = useGR((s) => s.shownM);
  const Mt = useGR((s) => s.M);
  const rpX = useGR((s) => s.orbitRp);
  const raX = useGR((s) => s.orbitRa);
  const phi = useGR((s) => s.orbitPhi);
  const playing = useGR((s) => s.playing);
  const el = useGR((s) => s.el);
  const newton = useGR((s) => s.show.newton);
  const gr = useGR.getState();
  const pick = (id: GRElement) => {
    gr.set({ selected: id });
    useLab.getState().toggleTheory(true);
  };

  const raMax = R_MAX / Mt;
  const raMin = 6.2;
  const rpMin = minPeriapsis(1, raX) + 0.02;
  const view = orbitView(M, rpX, raX);
  const o = view.orbit;
  const top = el > 1.2;

  const setRa = (v: number) => gr.set({ orbitRa: v, orbitRp: Math.min(Math.max(rpX, minPeriapsis(1, v) + 0.02), v), orbitPhi: 0 });

  return (
    <section className="panel">
      <h2>
        <button className="linklike inline-h" onClick={() => pick("orbit")}>Орбіта частинки</button>
      </h2>
      <label className="slider">
        <Tex tex={`r_a = ${raX.toFixed(2)}M`} />
        <input type="range" min={raMin} max={Math.max(raMin + 0.1, raMax)} step={0.01} value={Math.min(raX, raMax)} onChange={(e) => setRa(Number(e.target.value))} />
      </label>
      <label className="slider">
        <Tex tex={`r_p = ${rpX.toFixed(2)}M`} />
        <input type="range" min={rpMin} max={raX} step={0.01} value={Math.max(rpX, rpMin)} onChange={(e) => gr.set({ orbitRp: Number(e.target.value), orbitPhi: 0 })} />
      </label>
      <div className="row">
        <button className="ghost" onClick={() => gr.set({ playing: !playing })}>{playing ? "■ Пауза" : "▶ Рух"}</button>
        <button className="ghost" onClick={() => gr.set({ orbitPhi: 0 })}>↺ Заново</button>
        <button className="ghost" onClick={() => gr.set(top ? VIEW_3D : VIEW_TOP)}>{top ? "Вигляд 3D" : "Вигляд згори"}</button>
      </div>
      <label className="check">
        <input type="checkbox" checked={newton} onChange={() => gr.toggle("newton")} />
        Еліпс Ньютона з тими самими p, e
      </label>
      {o.valid ? (
        <>
          <div className="row small">
            <Tex tex={`E = ${fmt(o.E, 5)},\\ \\ L = ${fmt(o.L / M, 3)}M,\\ \\ p = ${fmt(o.p / M, 2)}M,\\ \\ e = ${fmt(o.e, 3)}`} />
          </div>
          <h3>
            <button className="linklike inline-h" onClick={() => pick("precession")}>Прецесія перигелію</button>
          </h3>
          <div className="row big">
            <Tex tex={`\\delta\\phi = ${fmt(deg(view.precession), 2)}^\\circ\\ \\text{за оберт}`} />
          </div>
          <div className="row small">
            <Tex tex={`\\frac{6\\pi M}{p} = ${fmt(deg(view.weak), 2)}^\\circ\\ \\ (\\text{точне}/\\text{наближене} = ${fmt(view.precession / view.weak, 3)})`} />
          </div>
          <div className="row small dim">
            <Tex tex={`\\text{Меркурій: } \\frac{6\\pi M_\\odot}{a(1-e^2)} \\to ${fmt(MERCURY_ARCSEC, 2)}''\\ \\text{за століття}`} />
          </div>
          <h3>
            <button className="linklike inline-h" onClick={() => pick("veff")}>Ефективний потенціал</button>
          </h3>
          <VeffPlot M={M} L={o.L} E2={o.E * o.E} rp={o.rp} ra={o.ra} rNow={rAt(view.track, phi)} onPick={() => pick("veff")} />
        </>
      ) : (
        <p className="warn small">З такими точками повороту стійкої орбіти немає.</p>
      )}
    </section>
  );
}
