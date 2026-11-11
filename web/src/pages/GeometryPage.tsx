// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Макс
import { useEffect } from "react";
import { GridLayer } from "../canvas/GridLayer";
import { makeChart } from "../geometry/chart";
import { Overlay } from "../overlay/Overlay";
import { useLab } from "../state/store";
import { loadIndex, loadPreset } from "../symbolic/presets";
import { ToolPanel } from "../ui/ToolPanels";
import { SidePanel } from "../ui/SidePanel";
import { TheoryDrawer } from "../ui/TheoryDrawer";

export function GeometryPage() {
  useEffect(() => {
    let alive = true;
    (async () => {
      const st = useLab.getState();
      if (!st.index.length) st.setIndex(await loadIndex());
      if (!useLab.getState().chart) {
        const a = await loadPreset("cartesian");
        if (alive) useLab.getState().setChart(makeChart(a));
      }
    })().catch((e) => console.error(e));

    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.ctrlKey || e.metaKey || e.altKey) return;
      const st = useLab.getState();
      if (e.key === "t" || e.key === "е") st.toggleTheory();
      else if (e.key === "r" || e.key === "к") st.resetFrame();
      else if (e.key === "f" || e.key === "а") st.toggleField();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      alive = false;
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <main className="page geometry">
      <div className="stage">
        <GridLayer />
        <Overlay />
      </div>
      <div className="left-col">
        <SidePanel />
        <ToolPanel />
      </div>
      <TheoryDrawer />
    </main>
  );
}
