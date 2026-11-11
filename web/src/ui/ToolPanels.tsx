// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Макс
/** Left-column panels of tools 1–4 (numbers update live with every drag). */
import { axisStep } from "../geometry/grid";
import type { M2, V2 } from "../geometry/linalg";
import { uk } from "../i18n/uk";
import { useLab } from "../state/store";
import { angleInfo, lengthInfo, metricInfo, vectorInfo } from "../tools/compute";
import { fmt, isIdentity, Matrix, MetricPanel, useHot } from "./MetricPanel";
import { RichText, Tex } from "./Tex";
import { COLORS } from "./theme";

const T = uk.toolPanels;
const pm = (m: M2, d = 2) => `\\begin{pmatrix}${fmt(m[0], d)} & ${fmt(m[1], d)}\\\\ ${fmt(m[2], d)} & ${fmt(m[3], d)}\\end{pmatrix}`;
const vecTex = (v: V2, d = 2) => `(${fmt(v[0], d)},\\ ${fmt(v[1], d)})`;
const deg = (rad: number) => `${((rad * 180) / Math.PI).toFixed(1)}^\\circ`;

function useCommon() {
  return {
    chart: useLab((s) => s.chart),
    frame: useLab((s) => s.frame),
    params: useLab((s) => s.params),
    probe: useLab((s) => s.probe),
  };
}

function Legend({ color, children, dashed }: { color: string; children: React.ReactNode; dashed?: boolean }) {
  return (
    <div className="legend">
      <span className="swatch" style={{ borderColor: color, borderStyle: dashed ? "dashed" : "solid" }} />
      <span>{children}</span>
    </div>
  );
}

// ------------------------------------------------------------------ metric
function MetricToolPanel() {
  const { chart, frame, params, probe } = useCommon();
  const frac = useLab((s) => s.cellFrac);
  const info = chart ? metricInfo(chart, frame, params, probe, frac, axisStep(chart, 0), axisStep(chart, 1)) : null;
  const hot = useHot(info ? [...info.g] : [1, 0, 0, 1]);
  if (!chart || !info) return null;
  const a = chart.analysis;
  const symbolic = chart.kind === "abstract" || isIdentity(frame);
  const idx = a.coords.map((c) => c.latex);
  return (
    <section className="panel tool-panel">
      <h2>{T.metric.title}</h2>
      <div className="row matrix-row">
        <Tex tex="g_{ij} =" />
        <Matrix values={[...info.g]} hot={hot} labels={[]} />
      </div>
      <div className="row">
        <Tex tex={`g^{ij} = ${pm(info.gInv, 3)}`} />
      </div>
      <div className="row small">
        <Tex tex={`g^{ik}g_{kj} = ${pm(info.delta, 3)} = \\delta^i_j`} />
      </div>
      <div className="row small stats">
        <Tex tex={`\\det g = ${fmt(info.det, 3)}`} />
        <Tex tex={`\\sqrt{g} = ${fmt(info.sqrtG, 3)}`} />
      </div>

      <h3>{T.metric.cell}</h3>
      <label className="slider">
        <Tex tex={`dx = ${frac.toFixed(2)}\\,\\Delta`} />
        <input type="range" min={0.05} max={1} step={0.01} value={frac} onChange={(e) => useLab.getState().setCellFrac(Number(e.target.value))} />
      </label>
      <Legend color={COLORS.cell}>
        <Tex tex={`\\iint \\sqrt{g}\\,dx^1dx^2 = ${fmt(info.cell.exact, 4)}`} />
      </Legend>
      <Legend color="#ffffff" dashed>
        <Tex tex={`\\sqrt{g}\\,dx^1dx^2 = ${fmt(info.cell.approx, 4)}`} />
      </Legend>
      <div className="row small dim">
        <Tex tex={`\\text{${T.metric.ratio}} = ${fmt(info.cell.approx / info.cell.exact, 4)}`} />
      </div>

      {symbolic ? (
        <div className="formula">
          <Tex display tex={`g^{ij} = ${a.inverse.latex}`} />
          <Tex display tex={`\\sqrt{|g|} = ${a.sqrtAbsDet}`} />
          <Tex display tex={`dA = ${a.sqrtAbsDet === "1" ? "" : a.sqrtAbsDet + "\\,"}d${idx[0]}\\,d${idx[1]}`} />
        </div>
      ) : (
        <p className="note">{T.metric.frameChanged}</p>
      )}
    </section>
  );
}

// ------------------------------------------------------------------ length
function LengthPanel() {
  const { chart, frame, params } = useCommon();
  const [A, B] = useLab((s) => s.lengthPts);
  if (!chart) return null;
  const info = lengthInfo(chart, frame, params, A, B);
  const c = chart.analysis.coords.map((x) => x.latex).join(",\\,");
  return (
    <section className="panel tool-panel">
      <h2>{T.length.title}</h2>
      <div className="row small">
        <Tex tex={`A:\\ (${c}) = ${vecTex(A)}`} />
        <Tex tex={`B:\\ ${vecTex(B)}`} />
      </div>
      <Legend color={COLORS.coordLine}>
        {T.length.coord}: <Tex tex={`L = ${fmt(info.coord, 4)}`} />
      </Legend>
      <Legend color={COLORS.geodesic} dashed>
        {T.length.geodesic}:{" "}
        {info.geo ? <Tex tex={`L = ${fmt(info.geo.length, 4)}`} /> : <span className="error">{T.length.noConv}</span>}
      </Legend>
      {info.chord !== null && (
        <div className="row small dim">
          <Tex tex={`|AB|_{\\text{${T.length.plane}}} = ${fmt(info.chord, 4)}`} />
        </div>
      )}
      {info.geo && (
        <div className="row small dim">
          {T.length.newton(info.geo.iterations, info.geo.miss.toExponential(1))}
          <Tex tex={`\\dot x(0) = ${vecTex(info.geo.v0, 3)}`} />
        </div>
      )}
      {info.geo && info.coord > info.geo.length + 1e-6 && (
        <p className="note">
          <RichText text={T.length.shorter(((1 - info.geo.length / info.coord) * 100).toFixed(1))} />
        </p>
      )}
      <h3>{T.length.equations}</h3>
      <div className="formula">
        {chart.analysis.geodesics.map((g, i) => (
          <Tex key={i} display tex={g} />
        ))}
      </div>
      <p className="note">{T.length.hint}</p>
    </section>
  );
}

// ------------------------------------------------------------------ vector
function VectorPanel() {
  const { chart, frame, params, probe } = useCommon();
  const v = useLab((s) => s.vec);
  const showDual = useLab((s) => s.showDual);
  if (!chart) return null;
  const info = vectorInfo(chart, frame, params, probe, v);
  return (
    <section className="panel tool-panel">
      <h2>{T.vector.title}</h2>
      <div className="row">
        <Tex tex={`v^i = ${vecTex(info.up)}`} />
        <span className="dim small">{T.vector.contra}</span>
      </div>
      <div className="row">
        <Tex tex={`v_i = g_{ij}v^j = ${vecTex(info.down)}`} />
        <span className="dim small">{T.vector.co}</span>
      </div>
      <div className="row small">
        <Tex tex={`|\\vec v|^2 = g_{ij}v^iv^j = v_iv^i = ${fmt(info.norm2, 3)}`} />
      </div>
      {chart.kind === "embedded" && (
        <div className="row small dim">
          <Tex tex={`\\vec v\\cdot\\vec v\\ (\\text{${T.vector.drawn}}) = ${fmt(v[0] * v[0] + v[1] * v[1], 3)}`} />
        </div>
      )}
      <div className="row small dim">
        <Tex tex={`v^i = g^{ij}v_j:\\ ${vecTex([info.gInv[0] * info.down[0] + info.gInv[1] * info.down[1], info.gInv[2] * info.down[0] + info.gInv[3] * info.down[1]] as V2)}`} />
      </div>
      {chart.kind === "embedded" && (
        <label className="check">
          <input type="checkbox" checked={showDual} onChange={() => useLab.getState().toggleDual()} />
          {T.vector.dual}
        </label>
      )}
      <div className="legends">
        <Legend color={COLORS.e1} dashed>
          <Tex tex={`v^1\\vec e_1,\\ v^2\\vec e_2`} />
        </Legend>
        {showDual && chart.kind === "embedded" && (
          <Legend color={COLORS.dual1}>
            <Tex tex={`\\vec e^{\\,i} = g^{ij}\\vec e_j,\\ \\ \\vec e^{\\,i}\\cdot\\vec e_j = \\delta^i_j`} />
          </Legend>
        )}
      </div>
      <p className="note">{chart.kind === "embedded" ? T.vector.hint : T.vector.abstract}</p>
    </section>
  );
}

// ------------------------------------------------------------------- angle
function AnglePanel() {
  const { chart, frame, params, probe } = useCommon();
  const [u, w] = useLab((s) => s.angleVecs);
  if (!chart) return null;
  const info = angleInfo(chart, frame, params, probe, u, w);
  const differs = Math.abs(info.angle - info.drawn) > 1e-3;
  return (
    <section className="panel tool-panel">
      <h2>{T.angle.title}</h2>
      <div className="row small">
        <Tex tex={`u^i = ${vecTex(info.up[0])}`} />
        <Tex tex={`w^i = ${vecTex(info.up[1])}`} />
      </div>
      <div className="row">
        <Tex tex={`g_{ij}u^iw^j = ${fmt(info.dot, 3)}`} />
      </div>
      <div className="row small">
        <Tex tex={`|u| = ${fmt(info.norms[0], 3)},\\ \\ |w| = ${fmt(info.norms[1], 3)}`} />
      </div>
      <div className="row">
        <Tex tex={`\\cos\\theta = \\frac{g_{ij}u^iw^j}{|u|\\,|w|} = ${fmt(info.cos, 4)}`} />
      </div>
      <div className="row big">
        <Tex tex={`\\theta = ${deg(info.angle)}`} />
      </div>
      <div className={`row small ${differs ? "warn" : "dim"}`}>
        <Tex tex={`\\theta_{\\text{${T.angle.drawn}}} = ${deg(info.drawn)}`} />
      </div>
      <p className="note">{chart.kind === "embedded" ? T.angle.same : differs ? T.angle.differs : T.angle.coincide}</p>
    </section>
  );
}

export function ToolPanel() {
  const tool = useLab((s) => s.tool);
  switch (tool) {
    case "metric":
      return <MetricToolPanel />;
    case "length":
      return <LengthPanel />;
    case "vector":
      return <VectorPanel />;
    case "angle":
      return <AnglePanel />;
    default:
      return <MetricPanel />;
  }
}
