# SPDX-License-Identifier: MIT
# Copyright (c) 2026 Макс
"""Parse a user-typed metric (strings) into a :class:`Metric`.

Runs in the Pyodide worker, i.e. inside the user's own browser sandbox.
"""
from __future__ import annotations

import keyword
import re
from typing import Mapping, Sequence

import sympy as sp
from sympy.parsing.sympy_parser import (convert_xor, implicit_multiplication_application,
                                        parse_expr, standard_transformations)

from .metric import Metric, MetricError

_TRANSFORMS = standard_transformations + (implicit_multiplication_application, convert_xor)
_NAME = re.compile(r"^[A-Za-z][A-Za-z0-9_]*$")
_FUNCS = {name: getattr(sp, name) for name in (
    "sin", "cos", "tan", "cot", "sec", "csc", "sinh", "cosh", "tanh", "coth",
    "exp", "log", "sqrt", "Abs", "asin", "acos", "atan")}
_FUNCS.update(pi=sp.pi, E=sp.E)


def _check_name(name: str) -> None:
    if not _NAME.match(name) or keyword.iskeyword(name) or name in _FUNCS:
        raise MetricError("bad_name", name)


def parse_metric(coords: Sequence[str], g: Sequence[Sequence[str]],
                 params: Sequence[str] | Mapping[str, float] = (),
                 lorentzian: bool = False, name: str = "custom") -> Metric:
    for c in list(coords) + list(params):
        _check_name(c)
    csyms = [sp.Symbol(c, real=True) for c in coords]
    psyms = [sp.Symbol(p, positive=True) for p in params]
    local = dict(_FUNCS)
    local.update({str(s): s for s in csyms + psyms})
    allowed = set(csyms) | set(psyms)

    n = len(coords)
    if len(g) != n or any(len(row) != n for row in g):
        raise MetricError("not_square", f"expected {n}×{n}")
    rows = []
    for i, row in enumerate(g):
        out = []
        for j, text in enumerate(row):
            text = (text or "0").strip() or "0"
            try:
                e = parse_expr(text, local_dict=local, transformations=_TRANSFORMS,
                               evaluate=True)
            except Exception as exc:
                raise MetricError("parse", f"g[{i}][{j}]: {text}") from exc
            unknown = e.free_symbols - allowed
            if unknown:
                raise MetricError("unknown_symbol",
                                  ", ".join(sorted(map(str, unknown))))
            out.append(e)
        rows.append(out)
    return Metric(csyms, rows, name=name, lorentzian=lorentzian)
