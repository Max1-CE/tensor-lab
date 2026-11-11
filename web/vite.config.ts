// SPDX-License-Identifier: MIT
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Relative base works both locally and under https://max1-ce.github.io/tensor-lab/
  base: "./",
  plugins: [react()],
  worker: { format: "es" },
  // The Pyodide worker imports ../core/*.py as raw text.
  server: { fs: { allow: [".."] } },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
