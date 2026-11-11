# SPDX-License-Identifier: MIT
# Copyright (c) 2026 Макс
"""Serialise a :class:`Metric` analysis to JSON (LaTeX + JS code).

The ``js`` block holds bodies of functions ``(x, p) => number[]`` where ``x`` is
the coordinate array and ``p`` the parameter object.  The web app compiles
them once with ``new Function('x', 'p', body)`` and feeds them to the numeric
integrators, so formulas on screen and numbers in RK4 share one source.
"""
from __future__ import annotations

from functools import lru_cache
from typing import Iterable, Sequence

import sympy as sp

from .metric import Metric

SCHEMA_VERSION = 1


def _tex(e) -> str:
    return sp.latex(e)


# --------------------------------------------------------------------- latex
def line_element_latex(m: Metric) -> str:
    d = [r"d" + _tex(c) for c in m.coords]
    terms = []
    for i in range(m.dim):
        for j in range(i, m.dim):
            c = m.g[i, j] * (1 if i == j else 2)
            if c == 0:
                continue
            diff = f"{d[i]}^{{2}}" if i == j else f"\\,{d[i]}\\,{d[j]}"
            if c == 1:
                coef = ""
            elif c == -1:
                coef = "-"
            else:
                ce = _tex(c)
                coef = f"\\left({ce}\\right)" if isinstance(c, sp.Add) else ce
            sep = r"\," if coef not in ("", "-") and i == j else ""
            terms.append(f"{coef}{sep}{diff}")
    body = " + ".join(terms).replace("+ -", "- ")
    return "ds^{2} = " + (body or "0")


def _idx(m: Metric, ids: Iterable[int]) -> str:
    return "".join(_tex(m.coords[i]) + " " for i in ids).strip()


def christoffel_latex(m: Metric, l: int, a: int, b: int, value) -> str:
    return (rf"\Gamma^{{{_idx(m, [l])}}}_{{{_idx(m, [a, b])}}} = {_tex(value)}")


def geodesic_latex(m: Metric) -> list[str]:
    v = m.velocity_symbols()
    names = {s: rf"\dot{{{_tex(c)}}}" for s, c in zip(v, m.coords)}
    out = []
    for c, rhs in zip(m.coords, m.geodesic_rhs()):
        out.append(rf"\ddot{{{_tex(c)}}} = " + sp.latex(rhs, symbol_names=names))
    return out


# ------------------------------------------------------------------------ js
def js_body(m: Metric, params: Sequence[sp.Symbol], exprs: Sequence[sp.Expr]) -> str:
    """Body of ``(x, p) => [...]`` evaluating ``exprs`` with common subexpressions."""
    sub = {c: sp.Symbol(f"x{i}", real=True) for i, c in enumerate(m.coords)}
    sub.update({p: sp.Symbol(f"p_{p}", positive=True) for p in params})
    exprs = [sp.sympify(e).xreplace(sub) for e in exprs]
    repl, reduced = sp.cse(exprs, symbols=sp.numbered_symbols("t_"), optimizations="basic")
    lines = [f"const x{i} = x[{i}];" for i in range(m.dim)]
    lines += [f'const p_{p} = p["{p}"];' for p in params]
    lines += [f"const {s} = {sp.jscode(e)};" for s, e in repl]
    lines.append("return [" + ", ".join(sp.jscode(e) for e in reduced) + "];")
    return "\n".join(lines)


def _flat(arr, n: int, rank: int) -> list:
    from itertools import product
    return [arr[idx] for idx in product(range(n), repeat=rank)]


# ---------------------------------------------------------------- full dump
def analyze(m: Metric, params: dict[sp.Symbol, float] | None = None,
            *, embedding: Sequence[sp.Expr] | None = None,
            with_kretschmann: bool = True) -> dict:
    params = dict(params or {})
    free = set().union(*(e.free_symbols for e in m.g)) - set(m.coords)
    for s in sorted(free - set(params), key=str):
        params[s] = 1.0  # unknown parameter: default to 1
    psyms = sorted(params, key=str)
    n = m.dim

    def mat_tex(M):
        return [[_tex(M[i, j]) for j in range(n)] for i in range(n)]

    chris = [{"upper": l, "lower": [a, b], "latex": christoffel_latex(m, l, a, b, v)}
             for l, a, b, v in m.christoffel_nonzero()]
    riem = [{"indices": list(idx),
             "latex": rf"R_{{{_idx(m, idx)}}} = {_tex(v)}"}
            for idx, v in m.riemann_independent() if v != 0]
    ricci = [{"indices": [i, j], "latex": rf"R_{{{_idx(m, [i, j])}}} = {_tex(m.ricci[i, j])}"}
             for i in range(n) for j in range(i, n) if m.ricci[i, j] != 0]
    ein = [{"indices": [i, j], "latex": rf"G_{{{_idx(m, [i, j])}}} = {_tex(m.einstein[i, j])}"}
           for i in range(n) for j in range(i, n) if m.einstein[i, j] != 0]
    eps = m.levi_civita_lower()
    eps_up = m.levi_civita_upper()

    js = {
        "metric": js_body(m, psyms, list(m.g)),
        "inverse": js_body(m, psyms, list(m.inv)),
        "christoffel": js_body(m, psyms, _flat(m.christoffel, n, 3)),
        "scalar": js_body(m, psyms, [m.scalar]),
    }
    if embedding is not None:
        js["embedding"] = js_body(m, psyms, list(embedding))

    out = {
        "schema": SCHEMA_VERSION,
        "name": m.name,
        "dim": n,
        "lorentzian": m.lorentzian,
        "coords": [{"name": str(c), "latex": _tex(c)} for c in m.coords],
        "params": [{"name": str(p), "latex": _tex(p), "default": float(params[p])}
                   for p in psyms],
        "metric": {"latex": _tex(m.g), "components": mat_tex(m.g)},
        "inverse": {"latex": _tex(m.inv), "components": mat_tex(m.inv)},
        "det": _tex(m.det),
        "sqrtAbsDet": _tex(m.sqrt_abs_det),
        "kroneckerOk": m.kronecker_check(),
        "lineElement": line_element_latex(m),
        "christoffel": chris,
        "riemann": {"independentCount": len(Metric.independent_index_set(n)),
                    "nonzero": riem},
        "ricci": ricci,
        "ricciFlat": not ricci,
        "scalar": _tex(m.scalar),
        "einstein": ein,
        "leviCivita": {
            "latex": (rf"\varepsilon_{{{_idx(m, range(n))}}} = \sqrt{{|g|}} = "
                      + _tex(eps[tuple(range(n))])),
            "lower": [{"indices": list(p), "value": _tex(v)} for p, v in eps.items()],
            "upper": [{"indices": list(p), "value": _tex(v)} for p, v in eps_up.items()],
        },
        "geodesics": geodesic_latex(m),
        "js": js,
    }
    if n == 2:
        out["gaussian"] = _tex(m.gaussian_curvature())
    if with_kretschmann:
        out["kretschmann"] = _tex(m.kretschmann)
    return out


# ------------------------------------------------------------------- cache
@lru_cache(maxsize=64)
def _analyze_cached(key: str, coords: tuple, g: tuple, lorentzian: bool) -> dict:
    from .parse import parse_metric
    return analyze(parse_metric(coords, [list(r) for r in g], lorentzian=lorentzian,
                                params=sorted(_param_names(coords, g))))


def _param_names(coords, g) -> set[str]:
    import re
    ident = re.compile(r"[A-Za-z][A-Za-z0-9_]*")
    from .parse import _FUNCS
    names = {w for row in g for cell in row for w in ident.findall(cell or "")}
    return names - set(coords) - set(_FUNCS)


def analyze_strings(coords: Sequence[str], g: Sequence[Sequence[str]],
                    lorentzian: bool = False) -> dict:
    """Entry point for the worker: parse + analyse, memoised on the input."""
    coords_t = tuple(coords)
    g_t = tuple(tuple((c or "0").strip() for c in row) for row in g)
    key = repr((coords_t, g_t, lorentzian))
    return _analyze_cached(key, coords_t, g_t, lorentzian)
