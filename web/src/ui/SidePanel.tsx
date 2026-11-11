// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Макс
/** Chart picker, parameters, toggles and the custom-metric form. */
import { useEffect, useState } from "react";
import { makeChart, type ChartDisplay } from "../geometry/chart";
import { uk } from "../i18n/uk";
import { useLab } from "../state/store";
import { analyzeCustom, warmupCustom, type BootStage } from "../symbolic/client";
import { loadPreset } from "../symbolic/presets";
import { Tex } from "./Tex";

const PARAM_RANGE: Record<string, [number, number]> = { alpha: [0.15, Math.PI - 0.15] };

function CustomMetricForm() {
  const [coords, setCoords] = useState(["theta", "phi"]);
  const [g, setG] = useState(["1", "0", "sin(theta)^2"]);
  const [dom, setDom] = useState(["0.15", "2.99", "0", "6.28"]);
  const [busy, setBusy] = useState<BootStage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warm, setWarm] = useState<BootStage | "failed">("runtime");

  useEffect(() => {
    let alive = true;
    warmupCustom((st) => alive && setWarm(st)).then((ok) => alive && setWarm(ok ? "ready" : "failed"));
    return () => {
      alive = false;
    };
  }, []);

  const run = async () => {
    setError(null);
    setBusy("runtime");
    const res = await analyzeCustom(coords, [[g[0], g[1]], [g[1], g[2]]], setBusy);
    setBusy(null);
    if (!res.ok) {
      const msg = uk.custom.errors[res.code] ?? res.code;
      setError(res.detail && res.code !== "worker_failed" ? `${msg}: ${res.detail}` : msg);
      return;
    }
    const [a0, a1, b0, b1] = dom.map(Number);
    const ok = [a0, a1, b0, b1].every(Number.isFinite) && a1 > a0 && b1 > b0;
    const r0: [number, number] = ok ? [a0, a1] : [-4, 4];
    const r1: [number, number] = ok ? [b0, b1] : [-4, 4];
    const display: ChartDisplay = {
      axes: [
        { range: r0, lines: 17, periodic: false },
        { range: r1, lines: 17, periodic: false },
      ],
      affine: false,
      probe: [(r0[0] + r0[1]) / 2, (r1[0] + r1[1]) / 2],
    };
    const analysis = { ...res.result, title: uk.panel.custom };
    try {
      useLab.getState().setChart(makeChart(analysis, display, "custom"));
    } catch (e) {
      setError(String(e));
    }
  };

  const cell = (i: number, label: string) => (
    <label className="cell-input">
      <Tex tex={label} />
      <input value={g[i]} spellCheck={false} onChange={(e) => setG(g.map((x, k) => (k === i ? e.target.value : x)))} />
    </label>
  );

  return (
    <div className="custom-form">
      <div className="row">
        <span className="lbl">{uk.custom.coords}</span>
        {coords.map((c, i) => (
          <input
            key={i}
            className="coord-input"
            value={c}
            spellCheck={false}
            onChange={(e) => setCoords(coords.map((x, k) => (k === i ? e.target.value.trim() : x)))}
          />
        ))}
      </div>
      {cell(0, "g_{11}")}
      {cell(1, "g_{12} = g_{21}")}
      {cell(2, "g_{22}")}
      <div className="row domain">
        <span className="lbl">{uk.custom.domain}</span>
        {dom.map((d, i) => (
          <input key={i} value={d} onChange={(e) => setDom(dom.map((x, k) => (k === i ? e.target.value : x)))} />
        ))}
      </div>
      <p className="note">{uk.custom.hint}</p>
      <button className="primary" disabled={!!busy} onClick={run}>
        {busy ? uk.custom.computing : uk.custom.compute}
      </button>
      {busy && <p className="status">{uk.custom.stages[busy]}</p>}
      {!busy && warm !== "ready" && warm !== "failed" && (
        <p className="status dim">
          {uk.custom.warming} {uk.custom.stages[warm]}
        </p>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}

export function SidePanel() {
  const index = useLab((s) => s.index);
  const chart = useLab((s) => s.chart);
  const params = useLab((s) => s.params);
  const showField = useLab((s) => s.showField);
  const [customOpen, setCustomOpen] = useState(false);
  const st = useLab.getState();

  const pick = async (id: string) => {
    setCustomOpen(false);
    const a = await loadPreset(id);
    useLab.getState().setChart(makeChart(a));
  };

  const planes = index.filter((p) => p.kind === "plane");
  return (
    <section className="panel side-panel">
      <h2>{uk.panel.system}</h2>
      <div className="chips">
        {planes.map((p) => (
          <button key={p.id} className={chart?.id === p.id && !customOpen ? "chip on" : "chip"} onClick={() => pick(p.id)}>
            {p.title}
          </button>
        ))}
        <button className={customOpen || chart?.id === "custom" ? "chip on" : "chip"} onClick={() => setCustomOpen(!customOpen)}>
          {uk.panel.custom}…
        </button>
      </div>

      {customOpen && <CustomMetricForm />}

      {chart && chart.analysis.params.length > 0 && chart.id !== "custom" && (
        <div className="params">
          {chart.analysis.params.map((p) => {
            const [lo, hi] = PARAM_RANGE[p.name] ?? [0.2, 3];
            const val = params[p.name] ?? p.default;
            return (
              <label key={p.name} className="slider">
                <Tex tex={`${p.latex} = ${val.toFixed(2)}`} />
                <input
                  type="range"
                  min={lo}
                  max={hi}
                  step={0.01}
                  value={val}
                  onChange={(e) => st.setParam(p.name, Number(e.target.value))}
                />
              </label>
            );
          })}
        </div>
      )}

      <div className="row toggles">
        {chart?.kind === "embedded" && (
          <label className="check">
            <input type="checkbox" checked={showField} onChange={() => st.toggleField()} />
            {uk.panel.field}
          </label>
        )}
        <button className="ghost" onClick={() => st.resetFrame()}>
          {uk.panel.reset}
        </button>
      </div>
    </section>
  );
}
