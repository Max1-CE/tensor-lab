// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Макс
import type { ReactNode } from "react";
import { uk } from "../i18n/uk";
import { useLab, type ToolId } from "../state/store";
import { TOOL_CARDS } from "../theory/cards";
import { GR_MODULES } from "../gr/modules";
import { R_MAX, useGR } from "../gr/store";

const ICONS: Record<ToolId, ReactNode> = {
  frame: <path d="M5 19 L19 19 M5 19 L13 7 M17 17 L19 19 L17 21 M11 7.5 L13 7 L13.6 9" />,
  metric: <path d="M5 5 H9 M5 5 V19 H9 M19 5 H15 M19 5 V19 H15 M10 10 H14 M10 14 H14" />,
  length: <path d="M4 18 C8 6 14 20 20 6 M4 18 m-1.5 0 a1.5 1.5 0 1 0 3 0 a1.5 1.5 0 1 0 -3 0 M20 6 m-1.5 0 a1.5 1.5 0 1 0 3 0 a1.5 1.5 0 1 0 -3 0" />,
  vector: <path d="M5 19 L18 8 M18 8 L13 8.5 M18 8 L17 13 M5 19 L18 19 M18 8 L18 19" />,
  angle: <path d="M4 19 H20 M4 19 L16 6 M10 19 A6 6 0 0 0 8.2 14.6" />,
  christoffel: <path d="M7 5 H17 M7 5 V19 M13 10 l3 3 M13 13 l3 -3" />,
  transport: <path d="M4 16 C8 8 16 8 20 16 M6 12 l2 -4 M12 9.5 l0 -4.5 M18 12 l-2 -4" />,
  geodesic: <path d="M4 12 C9 4 15 4 20 8 M4 12 C9 12 15 12 20 12 M4 12 C9 20 15 20 20 16" />,
  curvature: <path d="M3 17 C7 7 17 7 21 17 M3 17 C7 13 17 13 21 17" />,
  symbols: <path d="M5 8 C5 5 10 5 10 8 C10 11 5 11 5 14 C5 17 10 17 10 14 M14 9 C17 7 20 9 17 11 C20 13 17 16 14 14" />,
};

const GR_ICONS: Record<string, ReactNode> = {
  embedding: <path d="M3 7 C8 7 9 18 12 18 C15 18 16 7 21 7 M6 10 H18" />,
  orbits: <path d="M12 12 m-2 0 a2 2 0 1 0 4 0 a2 2 0 1 0 -4 0 M4 12 a8 4 0 1 0 16 0 a8 4 0 1 0 -16 0" />,
  light: <path d="M3 6 C10 6 12 12 21 18 M12 12 m-2 0 a2 2 0 1 0 4 0 a2 2 0 1 0 -4 0" />,
  kerr: <path d="M12 12 m-3 0 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0 M4 12 a8 8 0 0 1 14 -5 M18 7 l0 -3 M18 7 l-3 0" />,
};

export function Toolbar() {
  const page = useLab((s) => s.page);
  const tool = useLab((s) => s.tool);
  const theoryOpen = useLab((s) => s.theoryOpen);
  const grModule = useGR((s) => s.module);
  const { setPage, setTool, toggleTheory } = useLab.getState();

  return (
    <header className="toolbar">
      <div className="brand">
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
          <path d="M3 20 Q12 0 21 20" stroke="#3d7bff" strokeWidth="2" fill="none" />
          <path d="M6 18 L15 15" stroke="#ffc857" strokeWidth="2" />
        </svg>
        <span>{uk.appName}</span>
      </div>
      <nav className="pages">
        {(["geometry", "gr"] as const).map((p) => (
          <button key={p} className={page === p ? "on" : ""} onClick={() => setPage(p)}>
            {uk.pages[p]}
          </button>
        ))}
      </nav>
      {page === "gr" && (
        <nav className="tools">
          {GR_MODULES.map((m) => (
            <button
              key={m.id}
              className={`tool${grModule === m.id ? " on" : ""}${m.ready ? "" : " later"}`}
              title={m.ready ? m.title : `${m.title} — ${uk.gr.planned}`}
              disabled={!m.ready}
              onClick={() => {
                const gr = useGR.getState();
                // orbits need room: keep the apoapsis inside the drawn region
                const M = m.id === "orbits" ? Math.min(gr.M, R_MAX / gr.orbitRa) : gr.M;
                gr.set({ module: m.id, selected: m.id === "orbits" ? "orbit" : "flamm", M, orbitPhi: 0 });
              }}
            >
              <svg viewBox="0 0 24 24" aria-hidden>
                {GR_ICONS[m.id]}
              </svg>
              <span>{m.title}</span>
            </button>
          ))}
        </nav>
      )}
      {page === "geometry" && (
        <nav className="tools">
          {(Object.keys(ICONS) as ToolId[]).map((t) => {
            const stage = TOOL_CARDS[t].stage;
            return (
              <button
                key={t}
                className={`tool${tool === t ? " on" : ""}${stage ? " later" : ""}`}
                onClick={() => setTool(t)}
                title={stage ? `${TOOL_CARDS[t].title} — ${uk.soon(stage)}` : TOOL_CARDS[t].title}
              >
                <svg viewBox="0 0 24 24" aria-hidden>
                  {ICONS[t]}
                </svg>
                <span>{uk.tools[t]}</span>
              </button>
            );
          })}
        </nav>
      )}
      <button className={`theory-toggle${theoryOpen ? " on" : ""}`} onClick={() => toggleTheory()}>
        {uk.theory}
      </button>
    </header>
  );
}
