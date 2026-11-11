// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Макс
/** Live g_ij at the probe point, with changed components highlighted. */
import { useEffect, useReducer, useRef } from "react";
import { localBasis, metricAt, toWorld, type Chart, type Frame } from "../geometry/chart";
import { I2, det, gram, type M2 } from "../geometry/linalg";
import { uk } from "../i18n/uk";
import { useLab } from "../state/store";
import { RichText, Tex } from "./Tex";

const HOT_MS = 550;

export const fmt = (x: number, digits = 2): string => {
  if (!Number.isFinite(x)) return "—";
  const v = Math.abs(x) < 0.5 * 10 ** -digits ? 0 : x;
  return v.toFixed(digits).replace("-", "−");
};

const isIdentity = (f: Frame) =>
  f.O[0] === 0 && f.O[1] === 0 && f.A.every((a, i) => Math.abs(a - I2[i]) < 1e-12);

/** Numeric ds² for a constant metric. */
function numericLineElement(chart: Chart, g: M2): string {
  const [a, b] = chart.analysis.coords.map((c) => `d${c.latex}`);
  const term = (c: number, d: string) => {
    if (Math.abs(c) < 5e-3) return "";
    const s = fmt(Math.abs(c));
    return `${c < 0 ? " - " : " + "}${s === "1.00" ? "" : s + "\\,"}${d}`;
  };
  const body = (term(g[0], `${a}^2`) + term(2 * g[1], `${a}\\,${b}`) + term(g[3], `${b}^2`))
    .replace(/^ \+ /, "")
    .replace(/^ - /, "-");
  return `ds^2 = ${body || "0"}`;
}

function useHot(values: number[]): boolean[] {
  const prev = useRef<number[] | null>(null);
  const stamps = useRef<number[]>(values.map(() => -Infinity));
  const [, rerender] = useReducer((x: number) => x + 1, 0);
  const now = performance.now();
  if (prev.current && prev.current.length === values.length) {
    values.forEach((v, i) => {
      if (Math.abs(v - prev.current![i]) > 1e-4) stamps.current[i] = now;
    });
  }
  prev.current = values;
  const hot = stamps.current.map((t) => now - t < HOT_MS);
  const anyHot = hot.some(Boolean);
  useEffect(() => {
    if (!anyHot) return;
    const t = setTimeout(rerender, HOT_MS);
    return () => clearTimeout(t);
  });
  return hot;
}

function Matrix({ values, hot, labels }: { values: number[]; hot: boolean[]; labels: string[] }) {
  return (
    <div className="matrix" role="table">
      {values.map((v, i) => (
        <div key={i} className={`cell${hot[i] ? " hot" : ""}`} title={labels[i]} role="cell">
          {fmt(v)}
        </div>
      ))}
    </div>
  );
}

export function MetricPanel() {
  const chart = useLab((s) => s.chart);
  const frame = useLab((s) => s.frame);
  const probe = useLab((s) => s.probe);
  const params = useLab((s) => s.params);
  const g = chart ? metricAt(chart, frame, chart.display.affine ? [0, 0] : probe, params) : ([1, 0, 0, 1] as M2);
  const hot = useHot([...g]);
  if (!chart) return null;

  const affine = chart.display.affine;
  const q = affine ? [0, 0] : probe;
  const E = localBasis(chart, frame, q as [number, number], params);
  const P = toWorld(chart, frame, q as [number, number], params);
  const coords = chart.analysis.coords.map((c) => c.latex);
  const idx = coords.map((c) => c.replace(/\\/g, ""));
  const labels = [`g_${idx[0]}${idx[0]}`, `g_${idx[0]}${idx[1]}`, `g_${idx[1]}${idx[0]}`, `g_${idx[1]}${idx[1]}`];

  let formula = chart.analysis.lineElement;
  let note: string | null = null;
  if (chart.kind === "embedded" && !isIdentity(frame)) {
    if (affine) formula = numericLineElement(chart, g);
    else {
      const G = gram(frame.A);
      note = uk.panel.frameChanged;
      formula = `G = \\begin{pmatrix}${fmt(G[0])} & ${fmt(G[1])}\\\\ ${fmt(G[2])} & ${fmt(G[3])}\\end{pmatrix}`;
    }
  }

  return (
    <section className="panel metric-panel">
      <h2>{affine ? uk.panel.metricConst : uk.panel.metricAt}</h2>
      {!affine && (
        <div className="row small">
          <Tex tex={`P:\\ (${coords.join(",\\,")}) = (${fmt(q[0])},\\ ${fmt(q[1])})`} />
        </div>
      )}
      <div className="row matrix-row">
        <Tex tex="g_{ij} =" />
        <Matrix values={[...g]} hot={hot} labels={labels} />
      </div>
      <div className="row small stats">
        <span>
          <Tex tex={`\\det g = ${fmt(det(g), 3)}`} />
        </span>
        {chart.kind === "embedded" && (
          <>
            <span className="e1">
              <Tex tex={`|\\vec e_1| = ${fmt(Math.hypot(E[0], E[2]))}`} />
            </span>
            <span className="e2">
              <Tex tex={`|\\vec e_2| = ${fmt(Math.hypot(E[1], E[3]))}`} />
            </span>
          </>
        )}
      </div>
      {chart.kind === "embedded" && (
        <div className="row small dim vecs">
          <Tex tex={`\\vec e_1 = (${fmt(E[0])},\\ ${fmt(E[2])})`} />
          <Tex tex={`\\vec e_2 = (${fmt(E[1])},\\ ${fmt(E[3])})`} />
          {!affine && <Tex tex={`\\vec r_P = (${fmt(P[0])},\\ ${fmt(P[1])})`} />}
        </div>
      )}
      <div className="formula">
        {note && (
          <p className="note">
            <RichText text={note} />
          </p>
        )}
        <Tex tex={formula} display />
      </div>
      <p className="note">
        <RichText text={chart.kind === "embedded" ? uk.panel.frameNote : uk.panel.abstractNote} />
      </p>
    </section>
  );
}
