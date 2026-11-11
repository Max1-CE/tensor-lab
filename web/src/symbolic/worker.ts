// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Макс
/**
 * Pyodide Web Worker: runs the same core/*.py kernel as the pytest suite.
 * Booted lazily, only when the user analyses a custom metric.
 */
import * as Comlink from "comlink";
import type { PyodideAPI } from "pyodide";
import type { WorkerResult } from "./types";

export const PYODIDE_VERSION = "0.29.5";
const INDEX_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

// The kernel sources are bundled into the worker as plain text.
const sources = import.meta.glob("../../../core/*.py", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

export type BootStage = "runtime" | "sympy" | "kernel" | "ready";
type ProgressFn = (stage: BootStage) => void;

let booting: Promise<PyodideAPI> | null = null;

async function boot(progress?: ProgressFn): Promise<PyodideAPI> {
  progress?.("runtime");
  const mod = (await import(/* @vite-ignore */ `${INDEX_URL}pyodide.mjs`)) as {
    loadPyodide: (opts: { indexURL: string }) => Promise<PyodideAPI>;
  };
  const py = await mod.loadPyodide({ indexURL: INDEX_URL });
  progress?.("sympy");
  await py.loadPackage("sympy");
  progress?.("kernel");
  py.FS.mkdirTree("/lab/core");
  for (const [path, src] of Object.entries(sources)) {
    const file = path.split("/").pop()!;
    py.FS.writeFile(`/lab/core/${file}`, src);
  }
  py.runPython("import sys; sys.path.insert(0, '/lab'); import core");
  progress?.("ready");
  return py;
}

const RUN = `
import json
from core.export import analyze_strings
from core.metric import MetricError
try:
    _out = {"ok": True, "result": analyze_strings(list(_args["coords"]),
                                                   [list(r) for r in _args["g"]],
                                                   bool(_args["lorentzian"]))}
except MetricError as e:
    _out = {"ok": False, "code": e.code, "detail": e.detail}
except Exception as e:
    _out = {"ok": False, "code": "internal", "detail": repr(e)}
json.dumps(_out)
`;

function ensure(progress?: ProgressFn): Promise<PyodideAPI> {
  // A failed boot (e.g. offline) is forgotten so that the next call retries.
  booting ??= boot(progress).catch((e: unknown) => {
    booting = null;
    throw e;
  });
  return booting;
}

const api = {
  async warmup(progress?: ProgressFn): Promise<void> {
    await ensure(progress);
  },

  async analyze(
    coords: string[],
    g: string[][],
    lorentzian = false,
    progress?: ProgressFn,
  ): Promise<WorkerResult> {
    const py = await ensure(progress);
    py.globals.set("_args", py.toPy({ coords, g, lorentzian }));
    const text = py.runPython(RUN) as string;
    return JSON.parse(text) as WorkerResult;
  },
};

export type SymbolicWorker = typeof api;
Comlink.expose(api);
