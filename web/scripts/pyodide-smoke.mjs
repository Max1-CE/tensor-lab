// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Макс
// Integration check: run core/*.py under Pyodide (Node) exactly as the worker does.
// Usage: npm run smoke:pyodide   (downloads SymPy from the Pyodide CDN on first run)
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadPyodide } from "pyodide";

const core = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "core");
const t0 = performance.now();
const py = await loadPyodide();
await py.loadPackage("sympy", { messageCallback: () => {} });
py.FS.mkdirTree("/lab/core");
for (const f of readdirSync(core).filter((f) => f.endsWith(".py"))) {
  py.FS.writeFile(`/lab/core/${f}`, readFileSync(join(core, f), "utf8"));
}
py.runPython("import sys; sys.path.insert(0, '/lab'); import core");
const boot = performance.now() - t0;

const cases = [
  { coords: ["theta", "phi"], g: [["a^2", "0"], ["0", "a^2 sin(theta)^2"]], expect: "\\frac{2}{a^{2}}" },
  { coords: ["r", "phi"], g: [["1", "0"], ["0", "r^2"]], expect: "0" },
  { coords: ["x", "y"], g: [["1", "x"], ["0", "1"]], error: "not_symmetric" },
];
let fail = 0;
for (const c of cases) {
  py.globals.set("_args", py.toPy(c));
  const out = JSON.parse(py.runPython(`
import json
from core.export import analyze_strings
from core.metric import MetricError
try:
    _o = {"ok": True, "result": analyze_strings(list(_args["coords"]), [list(r) for r in _args["g"]])}
except MetricError as e:
    _o = {"ok": False, "code": e.code}
json.dumps(_o)`));
  const good = c.error ? !out.ok && out.code === c.error : out.ok && out.result.scalar === c.expect;
  console.log(good ? "ok  " : "FAIL", JSON.stringify(c.g), out.ok ? `R = ${out.result.scalar}` : out.code);
  if (!good) fail++;
}
const ver = py.runPython("import sympy, sys; f'sympy {sympy.__version__}, python {sys.version.split()[0]}'");
console.log(`${ver}; boot ${(boot / 1000).toFixed(1)} s`);
process.exit(fail ? 1 : 0);
