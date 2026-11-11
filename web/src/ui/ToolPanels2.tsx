// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Макс
/** Left-column panels of tools 5–9. */
import { useState, type ReactNode } from "react";
import { localBasis } from "../geometry/chart";
import { det, inv, mulV, type V2 } from "../geometry/linalg";
import { useTransportAnimation } from "../overlay/tools2";
import { uk } from "../i18n/uk";
import { useLab } from "../state/store";
import { probeQ } from "../tools/compute";
import {
  christoffelInfo,
  curvatureGrid,
  fanInfo,
  metricAtProbe,
  scalarAt,
  transportInfo,
} from "../tools/compute2";
import { fmt } from "./MetricPanel";
import { RichText, Tex } from "./Tex";
import { COLORS } from "./theme";

const T = uk.toolPanels;
const vecTex = (v: V2, d = 2) => `(${fmt(v[0], d)},\\ ${fmt(v[1], d)})`;
const deg = (rad: number) => `${((rad * 180) / Math.PI).toFixed(2)}^\\circ`;

function useCommon() {
  return {
    chart: useLab((s) => s.chart),
    frame: useLab((s) => s.frame),
    params: useLab((s) => s.params),
    probe: useLab((s) => s.probe),
  };
}

function Seg<K extends string | number>({ value, options, onChange }: {
  value: K; options: { key: K; label: ReactNode }[]; onChange: (k: K) => void;
}) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={String(o.key)} className={o.key === value ? "on" : ""} onClick={() => onChange(o.key)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Slider({ label, value, min, max, step, onChange }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void;
}) {
  return (
    <label className="slider">
      <Tex tex={label} />
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

// --------------------------------------------------------- 5. Christoffel
function ChristoffelPanel() {
  const { chart, frame, params, probe } = useCommon();
  const j = useLab((s) => s.christoffelDir);
  if (!chart) return null;
  const info = christoffelInfo(chart, frame, params, probe, j);
  const c = chart.analysis.coords.map((x) => x.latex);
  const entries: string[] = [];
  for (let l = 0; l < 2; l++)
    for (let m = 0; m < 2; m++)
      for (let n = m; n < 2; n++) entries.push(`\\Gamma^{${c[l]}}_{${c[m]}${c[n]}} = ${fmt(info.gamma[4 * l + 2 * m + n], 3)}`);
  return (
    <section className="panel tool-panel">
      <h2>{T.christoffel.title}</h2>
      {chart.analysis.christoffel.length ? (
        <div className="formula">
          {chart.analysis.christoffel.map((g, i) => (
            <Tex key={i} display tex={g.latex} />
          ))}
        </div>
      ) : (
        <p className="note">
          <RichText text={T.christoffel.allZero} />
        </p>
      )}
      <h3>{T.christoffel.atP}</h3>
      <div className="grid2">
        {entries.map((e, i) => (
          <Tex key={i} tex={e} />
        ))}
      </div>
      <h3>{T.christoffel.shift}</h3>
      <Seg
        value={j}
        options={[0, 1].map((k) => ({ key: k as 0 | 1, label: <Tex tex={`\\partial_{${c[k]}}`} /> }))}
        onChange={(k) => useLab.getState().set({ christoffelDir: k })}
      />
      <div className="row small">
        <Tex tex={`\\partial_{${c[j]}}\\vec e_i = \\Gamma^k_{i${c[j]}}\\,\\vec e_k`} />
      </div>
      {[0, 1].map((i) => (
        <div key={i} className="row small">
          <Tex tex={`\\partial_{${c[j]}}\\vec e_{${c[i]}} = ${vecTex(info.predicted[i], 3)}`} />
          {info.measured && <span className="dim"><Tex tex={`\\ \\text{${T.christoffel.measured}}\\ ${vecTex(info.measured[i], 3)}`} /></span>}
        </div>
      ))}
      <p className="note">{chart.kind === "embedded" ? T.christoffel.hint : T.christoffel.abstract}</p>
    </section>
  );
}

// ---------------------------------------------------- 6. parallel transport
function TransportPanel() {
  const { chart, frame, params, probe } = useCommon();
  const kind = useLab((s) => s.loopKind);
  const r = useLab((s) => s.loopR);
  const v0 = useLab((s) => s.transportV0);
  const playing = useLab((s) => s.transportT !== null);
  useTransportAnimation(playing);
  if (!chart) return null;
  const info = transportInfo(chart, frame, params, probe, kind, r, v0);
  const periodic = chart.display.axes[1].periodic;
  const c = chart.analysis.coords.map((x) => x.latex);
  const st = useLab.getState();
  const last = info.steps[info.steps.length - 1];
  const norm = (q: V2, v: V2) => {
    const g = chart.kind === "abstract" ? chart.metricFn(q, params) : null;
    if (g) return Math.sqrt(g[0] * v[0] * v[0] + 2 * g[1] * v[0] * v[1] + g[3] * v[1] * v[1]);
    const E = localBasis(chart, frame, q, params);
    const w = mulV(E, v);
    return Math.hypot(w[0], w[1]);
  };
  return (
    <section className="panel tool-panel">
      <h2>{T.transport.title}</h2>
      <Seg
        value={kind}
        options={[
          { key: "circle" as const, label: T.transport.circle },
          ...(periodic ? [{ key: "line" as const, label: <Tex tex={`${c[0]} = \\text{const}`} /> }] : []),
        ]}
        onChange={(k) => st.set({ loopKind: k })}
      />
      {kind === "circle" && <Slider label={`\\rho = ${r.toFixed(1)}`} value={r} min={0.3} max={6} step={0.1} onChange={(v) => st.set({ loopR: v })} />}
      <div className="row">
        <button className="ghost" onClick={() => st.set({ transportT: playing ? null : 0 })}>
          {playing ? T.transport.stop : T.transport.play}
        </button>
      </div>
      <div className="legend">
        <span className="swatch" style={{ borderColor: COLORS.vec }} />
        <Tex tex={`v(0) = ${vecTex(v0, 3)}`} />
      </div>
      <div className="legend">
        <span className="swatch" style={{ borderColor: COLORS.transport }} />
        <Tex tex={`v(1) = ${vecTex(last.v, 3)}`} />
      </div>
      <div className="row big">
        <Tex tex={`\\Delta\\varphi = ${deg(info.angle)}`} />
      </div>
      {info.flux !== null ? (
        <div className="row">
          <Tex tex={`\\iint K\\,dA = ${deg(Math.atan2(Math.sin(info.flux), Math.cos(info.flux)))}\\ (${fmt(info.flux, 4)}\\ \\text{рад})`} />
        </div>
      ) : (
        <p className="note">{T.transport.noDisc}</p>
      )}
      <div className="row small dim">
        <Tex tex={`|v(0)| = ${fmt(norm(info.steps[0].q, v0), 4)},\\ \\ |v(1)| = ${fmt(norm(last.q, last.v), 4)}`} />
      </div>
      <p className="note">
        <RichText text={info.fluxNote === "cap" ? T.transport.capNote : T.transport.hint} />
      </p>
    </section>
  );
}

// --------------------------------------------------------- 7. geodesics
function Sparkline({ data, dAlpha }: { data: { s: number; d: number }[]; dAlpha: number }) {
  const [hover, setHover] = useState<number | null>(null);
  if (data.length < 2) return null;
  const W = 290;
  const H = 110;
  const pad = { l: 30, r: 8, t: 8, b: 20 };
  const sMax = data[data.length - 1].s;
  const ys = data.map((p) => p.d / dAlpha);
  const yMax = Math.max(sMax, ...ys) * 1.05;
  const X = (s: number) => pad.l + ((W - pad.l - pad.r) * s) / sMax;
  const Y = (y: number) => H - pad.b - ((H - pad.t - pad.b) * y) / yMax;
  const path = data.map((p, i) => `${i ? "L" : "M"}${X(p.s).toFixed(1)} ${Y(ys[i]).toFixed(1)}`).join("");
  const h = hover === null ? null : data[hover];
  return (
    <svg
      className="spark"
      width={W}
      height={H}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const s = ((e.clientX - r.left - pad.l) / (W - pad.l - pad.r)) * sMax;
        let best = 0;
        data.forEach((p, i) => (Math.abs(p.s - s) < Math.abs(data[best].s - s) ? (best = i) : 0));
        setHover(best);
      }}
      onMouseLeave={() => setHover(null)}
    >
      <line x1={pad.l} y1={H - pad.b} x2={W - pad.r} y2={H - pad.b} className="axis" />
      <line x1={pad.l} y1={pad.t} x2={pad.l} y2={H - pad.b} className="axis" />
      <line x1={X(0)} y1={Y(0)} x2={X(sMax)} y2={Y(sMax)} className="ref" />
      <path d={path} stroke={COLORS.geodesic} strokeWidth={2} fill="none" />
      <text x={pad.l - 4} y={pad.t + 8} className="tick" textAnchor="end">{yMax.toFixed(1)}</text>
      <text x={W - pad.r} y={H - 5} className="tick" textAnchor="end">s = {sMax.toFixed(1)}</text>
      {h && (
        <g>
          <line x1={X(h.s)} y1={pad.t} x2={X(h.s)} y2={H - pad.b} className="cross" />
          <circle cx={X(h.s)} cy={Y(h.d / dAlpha)} r={4} fill={COLORS.geodesic} stroke="#000" strokeWidth={2} />
          <text x={Math.min(X(h.s) + 6, W - 120)} y={pad.t + 12} className="tip">
            s = {h.s.toFixed(2)}, d/Δα = {(h.d / dAlpha).toFixed(3)}
          </text>
        </g>
      )}
    </svg>
  );
}

function FanPanel() {
  const { chart, frame, params, probe } = useCommon();
  const alpha = useLab((s) => s.fanAlpha);
  const spread = useLab((s) => s.fanSpread);
  const length = useLab((s) => s.fanLength);
  if (!chart) return null;
  const info = fanInfo(chart, frame, params, probe, alpha, spread, length);
  const K = scalarAt(chart, params, probeQ(chart, probe)) / 2;
  const st = useLab.getState();
  const maxLen = chart.kind === "abstract" ? 3 * Math.max(...chart.display.axes.map((a) => a.range[1] - a.range[0])) : 14;
  return (
    <section className="panel tool-panel">
      <h2>{T.geodesic.title}</h2>
      <Slider label={`\\sigma = ${((spread * 180) / Math.PI).toFixed(0)}^\\circ`} value={spread} min={0.02} max={Math.PI} step={0.01} onChange={(v) => st.set({ fanSpread: v })} />
      <Slider label={`L = ${length.toFixed(2)}`} value={length} min={0.2} max={maxLen} step={0.01} onChange={(v) => st.set({ fanLength: v })} />
      <div className="row">
        <Tex tex={`K(P) = R/2 = ${fmt(K, 4)}`} />
      </div>
      <h3>{T.geodesic.deviation}</h3>
      <Sparkline data={info.separation} dAlpha={info.dAlpha} />
      <div className="legend">
        <span className="swatch" style={{ borderColor: COLORS.geodesic }} />
        <span>{T.geodesic.actual}</span>
      </div>
      <div className="legend">
        <span className="swatch" style={{ borderColor: "#8b97bf", borderStyle: "dashed" }} />
        <span>{T.geodesic.flat}</span>
      </div>
      <p className="note">
        <RichText text={T.geodesic.hint} />
      </p>
    </section>
  );
}

// ---------------------------------------------------------- 8. curvature
function CurvaturePanel() {
  const { chart, params, probe } = useCommon();
  const hoverQ = useLab((s) => s.hoverQ);
  if (!chart) return null;
  const a = chart.analysis;
  const grid = curvatureGrid(chart, params, 96, 72);
  const Rp = scalarAt(chart, params, probeQ(chart, probe));
  const Rh = hoverQ ? scalarAt(chart, params, hoverQ) : null;
  const flat = grid.maxAbs < 1e-9;
  return (
    <section className="panel tool-panel">
      <h2>{T.curvature.title}</h2>
      <div className="row">
        <Tex tex={`R(P) = ${fmt(Rp, 4)},\\ \\ K = R/2 = ${fmt(Rp / 2, 4)}`} />
      </div>
      {Rh !== null && Number.isFinite(Rh) && (
        <div className="row small dim">
          <Tex tex={`R(\\text{${T.curvature.cursor}}) = ${fmt(Rh, 4)}`} />
        </div>
      )}
      {flat ? (
        <p className="note">
          <RichText text={T.curvature.flat} />
        </p>
      ) : (
        <div className="heat-legend">
          <div className="bar" />
          <div className="ticks">
            <span>{fmt(-grid.maxAbs, 3)}</span>
            <span>0</span>
            <span>{fmt(grid.maxAbs, 3)}</span>
          </div>
        </div>
      )}
      <h3>{T.curvature.symbolic}</h3>
      <div className="formula">
        <Tex display tex={`R = ${a.scalar}`} />
        {a.gaussian && <Tex display tex={`K = ${a.gaussian}`} />}
        {a.riemann.nonzero.map((r, i) => (
          <Tex key={i} display tex={r.latex} />
        ))}
        {a.ricci.length ? a.ricci.map((r, i) => <Tex key={`r${i}`} display tex={r.latex} />) : <Tex display tex="R_{\mu\nu} = 0" />}
        {a.einstein.length ? a.einstein.map((r, i) => <Tex key={`g${i}`} display tex={r.latex} />) : <Tex display tex="G_{\mu\nu} \equiv 0" />}
        {a.kretschmann && <Tex display tex={`R_{abcd}R^{abcd} = ${a.kretschmann}`} />}
      </div>
      <p className="note">
        <RichText text={T.curvature.note(a.riemann.independentCount)} />
      </p>
    </section>
  );
}

// ---------------------------------------------------------- 9. δ and ε
function perms3(): [number, number, number, number][] {
  const out: [number, number, number, number][] = [];
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      for (let k = 0; k < 3; k++) {
        const s = i === j || j === k || i === k ? 0 : (j - i) * (k - i) * (k - j) > 0 ? 1 : -1;
        out.push([i, j, k, s]);
      }
  return out;
}
const LC3 = new Map(perms3().map(([i, j, k, s]) => [`${i}${j}${k}`, s]));
const eps3 = (i: number, j: number, k: number) => LC3.get(`${i}${j}${k}`)!;
const delta = (i: number, j: number) => (i === j ? 1 : 0);

function SymbolsPanel() {
  const { chart, frame, params, probe } = useCommon();
  const n = useLab((s) => s.symN);
  const [u, w] = useLab((s) => s.angleVecs);
  const [id, setId] = useState<"trace" | "eps2" | "epsdelta" | "area">("epsdelta");
  const [idx, setIdx] = useState([0, 1, 0, 1]); // j k m n
  if (!chart) return null;
  const st = useLab.getState();
  const g = metricAtProbe(chart, frame, params, probe);
  const sqrtG = Math.sqrt(Math.abs(det(g)));
  const E = localBasis(chart, frame, probeQ(chart, probe), params);
  const uc = mulV(inv(E), u);
  const wc = mulV(inv(E), w);
  const range = Array.from({ length: n }, (_, i) => i);
  const sub = ["1", "2", "3"];

  let body: ReactNode = null;
  if (id === "trace") {
    body = <Tex display tex={`\\delta^i_i = ${range.map((i) => `\\delta^${sub[i]}_${sub[i]}`).join(" + ")} = ${n}`} />;
  } else if (id === "eps2") {
    body = (
      <>
        <Tex display tex={`\\varepsilon_{12} = \\sqrt{g} = ${fmt(sqrtG, 4)},\\quad \\varepsilon^{12} = \\tfrac{1}{\\sqrt g} = ${fmt(1 / sqrtG, 4)}`} />
        <Tex display tex={`\\varepsilon_{ij}\\varepsilon^{ij} = \\varepsilon_{12}\\varepsilon^{12} + \\varepsilon_{21}\\varepsilon^{21} = ${fmt(2 * sqrtG * (1 / sqrtG), 4)} = 2!`} />
      </>
    );
  } else if (id === "epsdelta") {
    const [j, k, m, nn] = idx;
    const terms = [0, 1, 2].map((i) => eps3(i, j, k) * eps3(i, m, nn));
    const lhs = terms.reduce((a, b) => a + b, 0);
    const rhs = delta(m, j) * delta(nn, k) - delta(nn, j) * delta(m, k);
    let ok = 0;
    for (let a = 0; a < 3; a++)
      for (let b = 0; b < 3; b++)
        for (let c = 0; c < 3; c++)
          for (let d = 0; d < 3; d++) {
            const l = [0, 1, 2].reduce((s, i) => s + eps3(i, a, b) * eps3(i, c, d), 0);
            if (l === delta(c, a) * delta(d, b) - delta(d, a) * delta(c, b)) ok++;
          }
    const pick = (pos: number) => (
      <select value={idx[pos]} onChange={(e) => setIdx(idx.map((x, q) => (q === pos ? Number(e.target.value) : x)))}>
        {[0, 1, 2].map((v) => (
          <option key={v} value={v}>
            {v + 1}
          </option>
        ))}
      </select>
    );
    body = (
      <>
        <div className="row small idx-pick">
          j {pick(0)} k {pick(1)} m {pick(2)} n {pick(3)}
        </div>
        <Tex
          display
          tex={`\\sum_i \\varepsilon_{i${sub[j]}${sub[k]}}\\varepsilon^{i${sub[m]}${sub[nn]}} = ${terms.map((t) => (t < 0 ? `(${t})` : t)).join(" + ")} = ${lhs}`}
        />
        <Tex display tex={`\\delta^{${sub[m]}}_{${sub[j]}}\\delta^{${sub[nn]}}_{${sub[k]}} - \\delta^{${sub[nn]}}_{${sub[j]}}\\delta^{${sub[m]}}_{${sub[k]}} = ${rhs}`} />
        <p className={lhs === rhs ? "ok" : "error"}>
          {lhs === rhs ? "✓" : "✗"} {T.symbols.checked(ok)}
        </p>
      </>
    );
  } else {
    const val = sqrtG * (uc[0] * wc[1] - uc[1] * wc[0]);
    body = (
      <>
        <Tex display tex={`u^i = ${vecTex(uc)},\\ w^i = ${vecTex(wc)}`} />
        <Tex display tex={`\\varepsilon_{ij}u^iw^j = \\sqrt{g}\\,(u^1w^2 - u^2w^1) = ${fmt(val, 4)}`} />
        {chart.kind === "embedded" && <Tex display tex={`S_{\\text{${T.symbols.drawn}}} = u_xw_y - u_yw_x = ${fmt(u[0] * w[1] - u[1] * w[0], 4)}`} />}
      </>
    );
  }

  return (
    <section className="panel tool-panel">
      <h2>{T.symbols.title}</h2>
      <Seg value={n} options={[{ key: 2 as const, label: "n = 2" }, { key: 3 as const, label: "n = 3" }]} onChange={(k) => st.set({ symN: k })} />
      <div className="sym-tables">
        <div>
          <Tex tex="\delta^i_j" />
          <table className="sym">
            <tbody>
              {range.map((i) => (
                <tr key={i}>
                  {range.map((j) => (
                    <td key={j} className={i === j ? "one" : ""}>{delta(i, j)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {n === 2 ? (
          <div>
            <Tex tex="[ij]" />
            <table className="sym">
              <tbody>
                {[0, 1].map((i) => (
                  <tr key={i}>
                    {[0, 1].map((j) => {
                      const v = i === j ? 0 : i < j ? 1 : -1;
                      return <td key={j} className={v > 0 ? "pos" : v < 0 ? "neg" : ""}>{v}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          [0, 1, 2].map((i) => (
            <div key={i}>
              <Tex tex={`[${sub[i]}jk]`} />
              <table className="sym">
                <tbody>
                  {[0, 1, 2].map((j) => (
                    <tr key={j}>
                      {[0, 1, 2].map((k) => {
                        const v = eps3(i, j, k);
                        return <td key={k} className={v > 0 ? "pos" : v < 0 ? "neg" : ""}>{v}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        )}
      </div>
      <h3>{T.symbols.identity}</h3>
      <Seg
        value={id}
        options={[
          { key: "trace" as const, label: <Tex tex="\delta^i_i" /> },
          { key: "eps2" as const, label: <Tex tex="\varepsilon_{ij}\varepsilon^{ij}" /> },
          { key: "epsdelta" as const, label: <Tex tex="\varepsilon\varepsilon = \delta\delta" /> },
          { key: "area" as const, label: <Tex tex="\varepsilon_{ij}u^iw^j" /> },
        ]}
        onChange={setId}
      />
      <div className="formula">{body}</div>
      <p className="note">
        <RichText text={T.symbols.hint} />
      </p>
    </section>
  );
}

export function ToolPanel2({ tool }: { tool: string }) {
  switch (tool) {
    case "christoffel":
      return <ChristoffelPanel />;
    case "transport":
      return <TransportPanel />;
    case "geodesic":
      return <FanPanel />;
    case "curvature":
      return <CurvaturePanel />;
    case "symbols":
      return <SymbolsPanel />;
    default:
      return null;
  }
}
