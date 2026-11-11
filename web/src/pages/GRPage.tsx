// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Макс
import { uk } from "../i18n/uk";
import { Tex } from "../ui/Tex";

export function GRPage() {
  return (
    <main className="page gr placeholder">
      <div className="panel">
        <h2>{uk.gr.title}</h2>
        <Tex
          display
          tex="ds^2 = -\left(1 - \frac{2M}{r}\right)dt^2 + \frac{dr^2}{1 - 2M/r} + r^2\,d\Omega^2"
        />
        <p className="note">{uk.gr.soon}</p>
      </div>
    </main>
  );
}
