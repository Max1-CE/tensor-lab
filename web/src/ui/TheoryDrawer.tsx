// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Макс
import { uk } from "../i18n/uk";
import { useLab } from "../state/store";
import { CHART_NOTES, TOOL_CARDS } from "../theory/cards";
import { RichText, Tex } from "./Tex";

export function TheoryDrawer() {
  const tool = useLab((s) => s.tool);
  const open = useLab((s) => s.theoryOpen);
  const chart = useLab((s) => s.chart);
  const card = TOOL_CARDS[tool];
  const note = chart ? CHART_NOTES[chart.id] : undefined;

  return (
    <aside className={`theory${open ? " open" : ""}`} aria-hidden={!open}>
      <div className="theory-head">
        <h2>{card.title}</h2>
        <button className="icon-btn" onClick={() => useLab.getState().toggleTheory(false)} aria-label={uk.close}>
          ×
        </button>
      </div>
      {card.stage && <p className="badge">Інструмент {uk.soon(card.stage)}</p>}
      {card.body.map((line, i) => (
        <p key={i}>
          <RichText text={line} />
        </p>
      ))}
      {chart && (
        <section className="chart-note">
          <h3>{chart.title}</h3>
          {note && (
            <p>
              <RichText text={note} />
            </p>
          )}
          <div className="formula">
            <Tex tex={chart.analysis.lineElement} display />
          </div>
        </section>
      )}
    </aside>
  );
}
