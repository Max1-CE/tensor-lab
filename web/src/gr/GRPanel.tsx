// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Макс
/** Left panel of the GR page: mass, characteristic radii, probe, symbolic results. */
import { useEffect, useState } from "react";
import { useLab } from "../state/store";
import { loadPreset } from "../symbolic/presets";
import type { Analysis } from "../symbolic/types";
import { fmt } from "../ui/MetricPanel";
import { RichText, Tex } from "../ui/Tex";
import { OrbitPanel } from "./OrbitPanel";
import { localQuantities, properDistance, SCHWARZSCHILD as ST, SUN_KM } from "./spacetime";
import { M_RANGE, R_MAX, useGR, type GRElement } from "./store";

const NAMES: Record<string, string> = {
  horizon: "Горизонт подій",
  photon: "Фотонна сфера",
  isco: "ISCO",
};

export function GRPanel() {
  const M = useGR((s) => s.M);
  const probeX = useGR((s) => s.probeX);
  const show = useGR((s) => s.show);
  const selected = useGR((s) => s.selected);
  const hover = useGR((s) => s.hover);
  const module = useGR((s) => s.module);
  const [symbolic, setSymbolic] = useState<Analysis | null>(null);
  const gr = useGR.getState();

  useEffect(() => {
    loadPreset("schwarzschild").then(setSymbolic).catch(() => {});
  }, []);

  const pick = (id: GRElement) => {
    gr.set({ selected: id });
    useLab.getState().toggleTheory(true);
  };
  const r = probeX * M;
  const q = localQuantities(r, M);
  const xMax = R_MAX / M;

  return (
    <div className="left-col">
      <section className="panel">
        <h2>Простір-час Шварцшильда</h2>
        <button className={`linklike${selected === "metric" ? " on" : ""}`} onClick={() => pick("metric")}>
          <Tex tex="ds^2 = -\Big(1-\frac{2M}{r}\Big)dt^2 + \frac{dr^2}{1-2M/r} + r^2 d\Omega^2" />
        </button>
        <label className="slider" onClick={() => pick("mass")}>
          <Tex tex={`M = ${M.toFixed(2)}\\,M_\\odot`} />
          <input type="range" min={M_RANGE[0]} max={M_RANGE[1]} step={0.01} value={M} onChange={(e) => gr.set({ M: Number(e.target.value) })} />
        </label>
        <div className="row small dim">
          <Tex tex={`r_s = 2M = ${fmt(2 * M * SUN_KM, 2)}\\ \\text{км}`} />
        </div>
        <button className={`linklike small${selected === "flamm" ? " on" : ""}`} onClick={() => pick("flamm")}>
          Діаграма вкладення Фламма: <Tex tex="z = 2\sqrt{2M(r-2M)}" />
        </button>
      </section>

      <section className="panel">
        <h2>Характерні радіуси</h2>
        {ST.radii.map((rad) => {
          const id = rad.id as "horizon" | "photon" | "isco";
          return (
            <div
              key={id}
              className={`radius-row${selected === id ? " on" : ""}${hover === id ? " hover" : ""}`}
              onClick={() => pick(id)}
              onMouseEnter={() => gr.set({ hover: id })}
              onMouseLeave={() => gr.set({ hover: null })}
            >
              <input type="checkbox" checked={show[id]} onClick={(e) => e.stopPropagation()} onChange={() => gr.toggle(id)} aria-label={NAMES[id]} />
              <span className="swatch" style={{ borderColor: rad.color }} />
              <span className="name">{NAMES[id]}</span>
              <Tex tex={`r = ${rad.label} = ${fmt(rad.r(M), 2)}`} />
              <span className="km">{fmt(rad.r(M) * SUN_KM, 1)} км</span>
            </div>
          );
        })}
        <div className="row small dim">
          <Tex tex={`\\text{власна відстань } 2M \\to 6M = ${fmt(properDistance(2 * M, 6 * M, M), 2)}\\ \\ (\\Delta r = ${fmt(4 * M, 2)})`} />
        </div>
        <label className="check">
          <input type="checkbox" checked={show.secondSheet} onChange={() => gr.toggle("secondSheet")} />
          Другий лист (міст Ейнштейна–Розена)
        </label>
      </section>

      {module === "orbits" ? (
        <OrbitPanel />
      ) : (
      <section className={`panel${selected === "probe" ? " focus" : ""}`} onClick={() => selected !== "probe" && pick("probe")}>
        <h2>
          <label className="check inline" onClick={(e) => e.stopPropagation()}>
            <input type="checkbox" checked={show.probe} onChange={() => gr.toggle("probe")} />
          </label>
          Пробна точка P
        </h2>
        <label className="slider">
          <Tex tex={`r = ${probeX.toFixed(2)}M`} />
          <input type="range" min={2.02} max={Math.max(2.1, xMax)} step={0.01} value={Math.min(probeX, xMax)} onChange={(e) => gr.set({ probeX: Number(e.target.value) })} />
        </label>
        <div className="row small">
          <Tex tex={`g_{tt} = ${fmt(q.gtt, 4)},\\ \\ g_{rr} = ${fmt(q.grr, 4)}`} />
        </div>
        <div className="row small">
          <Tex tex={`d\\tau/dt = \\sqrt{1-2M/r} = ${fmt(q.dilation, 4)}`} />
        </div>
        <div className="row small">
          <Tex tex={`v_{\\rm esc} = \\sqrt{2M/r} = ${fmt(q.escape, 3)}\\,c`} />
        </div>
        <div className="row small">
          {q.orbitSpeed === null ? (
            <span className="warn">Колових орбіт тут немає (r ≤ 3M)</span>
          ) : (
            <Tex tex={`v_{\\rm orb} = ${fmt(q.orbitSpeed, 3)}\\,c\\ \\text{${q.stable ? "(стійка)" : "(нестійка)"}}`} />
          )}
        </div>
        <div className="row small dim">
          <Tex tex={`\\text{від горизонту: } s = ${fmt(properDistance(2 * M, r, M), 2)},\\ \\ \\Delta r = ${fmt(r - 2 * M, 2)}`} />
        </div>
      </section>
      )}

      {symbolic && (
        <section className="panel">
          <details>
            <summary>Символьно (SymPy)</summary>
            <div className="formula">
              {symbolic.christoffel.map((c, i) => (
                <Tex key={i} display tex={c.latex} />
              ))}
              <Tex display tex="R_{\mu\nu} = 0,\quad R = 0,\quad G_{\mu\nu} = 0" />
              {symbolic.kretschmann && <Tex display tex={`R_{abcd}R^{abcd} = ${symbolic.kretschmann}`} />}
            </div>
            <p className="note">
              <RichText text={`Незалежних компонент тензора Рімана в 4D: ${symbolic.riemann.independentCount}; ненульових тут: ${symbolic.riemann.nonzero.length}.`} />
            </p>
          </details>
        </section>
      )}
    </div>
  );
}
