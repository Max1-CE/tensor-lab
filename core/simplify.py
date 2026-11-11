# SPDX-License-Identifier: MIT
# Copyright (c) 2026 Макс
"""Simplification pipeline used by every tensor computation.

Strategy: ``cancel`` first (cheap, canonical for rational functions), then
``trigsimp`` if trigonometric/hyperbolic functions are present, and finally
pick the shortest of the candidates.  Results are memoised, because the same
sub-expressions show up many times (e.g. Γ terms inside the Riemann tensor).
"""
from __future__ import annotations

from functools import lru_cache

import sympy as sp

_TRIG = (sp.sin, sp.cos, sp.tan, sp.cot, sp.sec, sp.csc,
         sp.sinh, sp.cosh, sp.tanh, sp.coth, sp.sech, sp.csch)


_W = sp.Wild("w")


def _cost(e: sp.Expr) -> tuple[int, int]:
    # Textbook style: single angles (sinθcosθ, not sin2θ/2) are preferred.
    multi_angle = sum(1 for f in e.atoms(sp.Function)
                      if isinstance(f, _TRIG) and f.args[0].is_Mul
                      and f.args[0].args[0].is_Number)
    return (sp.count_ops(e) + multi_angle, len(sp.srepr(e)))


def _pythagorean_forms(e: sp.Expr) -> list[sp.Expr]:
    """Eliminate cos²/cosh² (or sin²/sinh²) to expose cancellations such as
    sin²ν cosh²μ + cos²ν sinh²μ = sinh²μ + sin²ν."""
    to_sin = (e.replace(sp.cos(_W) ** 2, 1 - sp.sin(_W) ** 2)
               .replace(sp.cosh(_W) ** 2, 1 + sp.sinh(_W) ** 2))
    to_cos = (e.replace(sp.sin(_W) ** 2, 1 - sp.cos(_W) ** 2)
               .replace(sp.sinh(_W) ** 2, sp.cosh(_W) ** 2 - 1))
    return [sp.factor(sp.cancel(sp.expand(f))) for f in (to_sin, to_cos)]


def _cot_form(e: sp.Expr) -> sp.Expr:
    return e.replace(lambda x: x.is_Pow and isinstance(x.base, sp.tan) and x.exp.is_negative,
                     lambda x: sp.cot(x.base.args[0]) ** (-x.exp))


@lru_cache(maxsize=None)
def _simp_cached(expr: sp.Expr) -> sp.Expr:
    if expr.is_Number or expr.is_Symbol:
        return expr
    e = sp.cancel(sp.together(expr))
    if e == 0:
        return sp.S.Zero
    candidates = [e]
    if e.has(*_TRIG):
        t = sp.trigsimp(e)
        if t == 0:
            return sp.S.Zero
        candidates += [t, sp.cancel(t), sp.factor(t)]
        for c in (e, t):
            candidates += _pythagorean_forms(c)
        candidates += [sp.expand_trig(c) for c in list(candidates)]
        candidates += [_cot_form(c) for c in list(candidates)]
        if any(c == 0 for c in candidates):
            return sp.S.Zero
    else:
        candidates.append(sp.factor(e))
    return min(candidates, key=_cost)


def simp(expr) -> sp.Expr:
    """Aggressively simplify ``expr`` (memoised)."""
    return _simp_cached(sp.sympify(expr))


def is_zero(expr) -> bool:
    """True if ``expr`` is identically zero.

    Tries the cheap pipeline first and falls back to the full ``simplify``.
    """
    expr = sp.sympify(expr)
    if simp(expr) == 0:
        return True
    return sp.simplify(expr) == 0


def equal(a, b) -> bool:
    """Symbolic equality check via ``simplify(a - b) == 0``."""
    return is_zero(sp.sympify(a) - sp.sympify(b))


def sqrt_positive(expr) -> sp.Expr:
    """sqrt of an expression that is positive on the chart's principal domain.

    ``force=True`` lets SymPy write e.g. sqrt(a**4 sin(θ)**2) as a**2 sin(θ),
    which is the physics convention (θ ∈ (0, π)).
    """
    root = sp.sqrt(sp.factor(simp(expr)))
    root = sp.powdenest(sp.powsimp(root, force=True), force=True)
    # |f| -> f: on the principal domain of the chart the factors are positive.
    return simp(root.replace(sp.Abs, lambda x: x))


def clear_cache() -> None:
    _simp_cached.cache_clear()
