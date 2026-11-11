// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Макс
import { GR_CARDS } from "../gr/cards";
import { FlammCanvas } from "../gr/FlammCanvas";
import { GRPanel } from "../gr/GRPanel";
import { useGR } from "../gr/store";
import { uk } from "../i18n/uk";
import { useLab } from "../state/store";
import { RichText } from "../ui/Tex";

function GRTheory() {
  const open = useLab((s) => s.theoryOpen);
  const selected = useGR((s) => s.selected);
  const card = GR_CARDS[selected];
  return (
    <aside className={`theory${open ? " open" : ""}`} aria-hidden={!open}>
      <div className="theory-head">
        <h2>{card.title}</h2>
        <button className="icon-btn" onClick={() => useLab.getState().toggleTheory(false)} aria-label={uk.close}>
          ×
        </button>
      </div>
      {card.body.map((line, i) => (
        <p key={i}>
          <RichText text={line} />
        </p>
      ))}
      <p className="note">{uk.gr.hint}</p>
    </aside>
  );
}

export function GRPage() {
  return (
    <main className="page gr">
      <div className="stage">
        <FlammCanvas />
      </div>
      <GRPanel />
      <GRTheory />
    </main>
  );
}
