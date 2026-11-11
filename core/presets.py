# SPDX-License-Identifier: MIT
# Copyright (c) 2026 Макс
"""Built-in coordinate systems, surfaces and spacetimes.

Plane charts and surfaces are defined by a map into ℝ² / ℝ³; their metric is
the pullback g = Jᵀ J, so the metric shown in the UI is *derived*, not typed.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable

import sympy as sp

from .metric import Metric


@dataclass(frozen=True)
class Preset:
    id: str
    title: str                       # Ukrainian, shown in the UI
    kind: str                        # "plane" | "surface" | "spacetime"
    coords: tuple[sp.Symbol, ...]
    params: dict[sp.Symbol, float]   # symbol -> default value
    domain: tuple[tuple[float, float], ...]  # grid range per coordinate
    build: Callable[[], Metric] = field(repr=False)
    embedding: tuple[sp.Expr, ...] | None = None  # map into ℝ² or ℝ³

    def metric(self) -> Metric:
        return self.build()


def _real(*names: str):
    return sp.symbols(names, real=True)


def _pos(*names: str):
    return sp.symbols(names, positive=True)


def _from_map(pid, title, kind, coords, X, params, domain, **kw) -> Preset:
    coords = tuple(coords)
    X = tuple(X)
    return Preset(pid, title, kind, coords, params, domain,
                  build=lambda: Metric.from_embedding(coords, X, name=pid, **kw),
                  embedding=X)


def _all() -> list[Preset]:
    pi = float(sp.pi)
    out: list[Preset] = []

    x, y = _real("x", "y")
    out.append(_from_map("cartesian", "Декартова", "plane", (x, y), (x, y), {},
                         ((-4, 4), (-4, 4))))

    u, v = _real("u", "v")
    (alpha,) = _pos("alpha")
    out.append(_from_map("skew", "Коса (афінна)", "plane", (u, v),
                         (u + v * sp.cos(alpha), v * sp.sin(alpha)),
                         {alpha: pi / 3}, ((-4, 4), (-4, 4))))

    (r,) = _pos("r")
    (phi,) = _real("phi")
    out.append(_from_map("polar", "Полярна", "plane", (r, phi),
                         (r * sp.cos(phi), r * sp.sin(phi)), {},
                         ((0, 4), (0, 2 * pi))))

    (mu,) = _pos("mu")
    (nu,) = _real("nu")
    (a,) = _pos("a")
    out.append(_from_map("elliptic", "Еліптична", "plane", (mu, nu),
                         (a * sp.cosh(mu) * sp.cos(nu), a * sp.sinh(mu) * sp.sin(nu)),
                         {a: 1.0}, ((0, 2), (0, 2 * pi))))

    sigma, tau = _real("sigma", "tau")
    out.append(_from_map("parabolic", "Параболічна", "plane", (sigma, tau),
                         (sigma * tau, (tau**2 - sigma**2) / 2), {},
                         ((-2.5, 2.5), (0, 2.5))))

    (theta,) = _real("theta")
    out.append(_from_map("sphere", "Сфера", "surface", (theta, phi),
                         (a * sp.sin(theta) * sp.cos(phi),
                          a * sp.sin(theta) * sp.sin(phi),
                          a * sp.cos(theta)),
                         {a: 1.0}, ((0, pi), (0, 2 * pi))))

    R_, b = _pos("R", "b")
    out.append(_from_map("torus", "Тор", "surface", (u, v),
                         ((R_ + b * sp.cos(v)) * sp.cos(u),
                          (R_ + b * sp.cos(v)) * sp.sin(u),
                          b * sp.sin(v)),
                         {R_: 2.0, b: 1.0}, ((0, 2 * pi), (0, 2 * pi))))

    (k,) = _pos("k")
    out.append(_from_map("saddle", "Сідло", "surface", (u, v),
                         (u, v, k * (u**2 - v**2) / 2),
                         {k: 1.0}, ((-2, 2), (-2, 2))))

    (t,) = _real("t")
    (M,) = _pos("M")
    f = 1 - 2 * M / r
    out.append(Preset(
        "schwarzschild", "Шварцшильд", "spacetime", (t, r, theta, phi), {M: 1.0},
        ((0, 10), (2, 20), (0, pi), (0, 2 * pi)),
        build=lambda: Metric((t, r, theta, phi),
                             sp.diag(-f, 1 / f, r**2, r**2 * sp.sin(theta)**2),
                             name="schwarzschild", lorentzian=True)))
    return out


PRESETS: dict[str, Preset] = {p.id: p for p in _all()}


def get(pid: str) -> Preset:
    return PRESETS[pid]
