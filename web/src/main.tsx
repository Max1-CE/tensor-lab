// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Макс
import "katex/dist/katex.min.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { useLab } from "./state/store";
import { analyzeCustom } from "./symbolic/client";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Test hooks for scripted checks (screenshots, e2e).
Object.assign(window, { __lab: useLab, __analyzeCustom: analyzeCustom });
