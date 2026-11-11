// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Макс
/** Main-thread handle to the Pyodide worker (created on first use). */
import * as Comlink from "comlink";
import type { BootStage, SymbolicWorker } from "./worker";
import type { WorkerResult } from "./types";

let remote: Comlink.Remote<SymbolicWorker> | null = null;

function worker(): Comlink.Remote<SymbolicWorker> {
  if (!remote) {
    const w = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
    remote = Comlink.wrap<SymbolicWorker>(w);
  }
  return remote;
}

export type { BootStage };

/** Start loading Pyodide + SymPy in the background (e.g. when the form opens). */
export async function warmupCustom(onStage: (s: BootStage) => void): Promise<boolean> {
  try {
    await worker().warmup(Comlink.proxy(onStage));
    return true;
  } catch {
    return false;
  }
}

export async function analyzeCustom(
  coords: string[],
  g: string[][],
  onStage: (s: BootStage) => void,
  lorentzian = false,
): Promise<WorkerResult> {
  try {
    return await worker().analyze(coords, g, lorentzian, Comlink.proxy(onStage));
  } catch (e) {
    return { ok: false, code: "worker_failed", detail: String(e) };
  }
}
