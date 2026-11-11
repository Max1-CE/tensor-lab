// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Макс
import { GeometryPage } from "./pages/GeometryPage";
import { GRPage } from "./pages/GRPage";
import { useLab } from "./state/store";
import { Toolbar } from "./ui/Toolbar";

export function App() {
  const page = useLab((s) => s.page);
  return (
    <div className="app">
      <Toolbar />
      {page === "geometry" ? <GeometryPage /> : <GRPage />}
    </div>
  );
}
