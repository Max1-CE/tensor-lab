# SPDX-License-Identifier: MIT
# Copyright (c) 2026 Макс
"""Metric tensor and everything derived from it.

Conventions (see CONVENTIONS.md):

* Γ^λ_{μν} = ½ g^{λσ}(∂_μ g_{σν} + ∂_ν g_{σμ} − ∂_σ g_{μν})
* R^ρ_{σμν} = ∂_μ Γ^ρ_{νσ} − ∂_ν Γ^ρ_{μσ} + Γ^ρ_{μλ}Γ^λ_{νσ} − Γ^ρ_{νλ}Γ^λ_{μσ}
* R_{σν} = R^ρ_{σρν},  R = g^{σν} R_{σν},  G_{μν} = R_{μν} − ½ R g_{μν}
* Lorentzian signature (−,+,+,+), G = c = 1.

Index layout of the arrays: ``christoffel[l, m, n] = Γ^l_{mn}``,
``riemann[r, s, m, n] = R^r_{smn}``, ``riemann_lower[a, b, c, d] = R_{abcd}``.
"""
from __future__ import annotations

from functools import cached_property
from itertools import combinations, permutations
from typing import Iterable, Sequence

import sympy as sp

from .simplify import is_zero, simp, sqrt_positive


class MetricError(ValueError):
    """Invalid metric input. ``code`` is a stable key the UI translates."""

    def __init__(self, code: str, detail: str = ""):
        super().__init__(f"{code}: {detail}" if detail else code)
        self.code = code
        self.detail = detail


def _array(shape: Sequence[int]) -> sp.MutableDenseNDimArray:
    return sp.MutableDenseNDimArray.zeros(*shape)


class Metric:
    """A (pseudo-)Riemannian metric g_ij(x) in a single chart."""

    def __init__(self, coords: Iterable[sp.Symbol], g, *, name: str = "",
                 lorentzian: bool = False):
        self.coords: tuple[sp.Symbol, ...] = tuple(coords)
        n = len(self.coords)
        if not 2 <= n <= 4:
            raise MetricError("bad_dim", f"dimension {n} not in 2..4")
        if len(set(self.coords)) != n:
            raise MetricError("duplicate_coords")
        try:
            g = sp.Matrix(g)
        except Exception as exc:  # pragma: no cover - defensive
            raise MetricError("parse", str(exc)) from exc
        if g.shape != (n, n):
            raise MetricError("not_square", f"shape {g.shape}, expected {(n, n)}")
        g = g.applyfunc(simp)
        for i, j in combinations(range(n), 2):
            if not is_zero(g[i, j] - g[j, i]):
                raise MetricError("not_symmetric", f"g[{i},{j}] != g[{j},{i}]")
        self.g = g
        self.dim = n
        self.name = name
        self.lorentzian = lorentzian
        if is_zero(self.det):
            raise MetricError("degenerate", "det g = 0")

    # ------------------------------------------------------------------ build
    @classmethod
    def from_embedding(cls, coords, X, **kw) -> "Metric":
        """Induced (pullback) metric g = Jᵀ J of a map X: chart → ℝᵐ."""
        coords = tuple(coords)
        J = sp.Matrix(X).jacobian(coords)
        return cls(coords, (J.T * J).applyfunc(simp), **kw)

    # ------------------------------------------------------------- algebraic
    @cached_property
    def det(self) -> sp.Expr:
        return simp(self.g.det(method="berkowitz"))

    @cached_property
    def abs_det(self) -> sp.Expr:
        """|det g|; a Lorentzian metric has exactly one negative eigenvalue."""
        return simp(-self.det) if self.lorentzian else self.det

    @cached_property
    def sqrt_abs_det(self) -> sp.Expr:
        return sqrt_positive(self.abs_det)

    @cached_property
    def inv(self) -> sp.Matrix:
        if self.g.is_diagonal():
            return sp.diag(*[simp(1 / self.g[i, i]) for i in range(self.dim)])
        return (self.g.adjugate() / self.det).applyfunc(simp)

    def kronecker_check(self) -> bool:
        """Verify g^{ik} g_{kj} = δ^i_j symbolically."""
        prod = self.inv * self.g
        eye = sp.eye(self.dim)
        return all(is_zero(prod[i, j] - eye[i, j])
                   for i in range(self.dim) for j in range(self.dim))

    def line_element(self) -> sp.Expr:
        """ds² as an expression in symbols d<coord>."""
        d = [sp.Symbol("d" + str(c)) for c in self.coords]
        return sum(self.g[i, j] * d[i] * d[j]
                   for i in range(self.dim) for j in range(self.dim))

    # ----------------------------------------------------------- connection
    @cached_property
    def dg(self) -> sp.MutableDenseNDimArray:
        """dg[k, i, j] = ∂_k g_{ij}."""
        n = self.dim
        a = _array((n, n, n))
        for k in range(n):
            for i in range(n):
                for j in range(i, n):
                    v = simp(sp.diff(self.g[i, j], self.coords[k]))
                    a[k, i, j] = a[k, j, i] = v
        return a

    @cached_property
    def christoffel(self) -> sp.MutableDenseNDimArray:
        n, gi, dg = self.dim, self.inv, self.dg
        G = _array((n, n, n))
        for l in range(n):
            for m in range(n):
                for k in range(m, n):  # symmetric in the lower pair
                    v = sum(gi[l, s] * (dg[m, s, k] + dg[k, s, m] - dg[s, m, k])
                            for s in range(n)) / 2
                    G[l, m, k] = G[l, k, m] = simp(v)
        return G

    def christoffel_nonzero(self) -> list[tuple[int, int, int, sp.Expr]]:
        """Nonzero Γ^l_{mn} with m ≤ n (the rest follow by symmetry)."""
        n, G = self.dim, self.christoffel
        return [(l, m, k, G[l, m, k]) for l in range(n) for m in range(n)
                for k in range(m, n) if G[l, m, k] != 0]

    # ------------------------------------------------------------ curvature
    @cached_property
    def riemann(self) -> sp.MutableDenseNDimArray:
        n, G, x = self.dim, self.christoffel, self.coords
        R = _array((n, n, n, n))
        for r in range(n):
            for s in range(n):
                for m in range(n):
                    for v in range(m + 1, n):  # antisymmetric in the last pair
                        e = (sp.diff(G[r, v, s], x[m]) - sp.diff(G[r, m, s], x[v])
                             + sum(G[r, m, l] * G[l, v, s] - G[r, v, l] * G[l, m, s]
                                   for l in range(n)))
                        e = simp(e)
                        R[r, s, m, v] = e
                        R[r, s, v, m] = -e
        return R

    @cached_property
    def riemann_lower(self) -> sp.MutableDenseNDimArray:
        n, g, R = self.dim, self.g, self.riemann
        L = _array((n, n, n, n))
        for a, b in combinations(range(n), 2):
            for c, d in combinations(range(n), 2):
                v = simp(sum(g[a, k] * R[k, b, c, d] for k in range(n)))
                L[a, b, c, d] = v
                L[b, a, c, d] = -v
                L[a, b, d, c] = -v
                L[b, a, d, c] = v
        return L

    @staticmethod
    def independent_index_set(n: int) -> list[tuple[int, int, int, int]]:
        """Index tuples (a,b,c,d) of the n²(n²−1)/12 independent R_{abcd}.

        a<b, c<d, (a,b) ≤ (c,d) lexicographically; in 4D the component
        R_{0312} is dropped because the first Bianchi identity gives
        R_{0312} = R_{0213} − R_{0123}.
        """
        pairs = list(combinations(range(n), 2))
        out = [p + q for i, p in enumerate(pairs) for q in pairs[i:]]
        if n == 4:
            out.remove((0, 3, 1, 2))
        return out

    def riemann_independent(self) -> list[tuple[tuple[int, int, int, int], sp.Expr]]:
        L = self.riemann_lower
        return [(idx, L[idx]) for idx in self.independent_index_set(self.dim)]

    @cached_property
    def ricci(self) -> sp.Matrix:
        n, R = self.dim, self.riemann
        Ric = sp.zeros(n, n)
        for s in range(n):
            for v in range(s, n):
                Ric[s, v] = Ric[v, s] = simp(sum(R[r, s, r, v] for r in range(n)))
        return Ric

    @cached_property
    def scalar(self) -> sp.Expr:
        n = self.dim
        return simp(sum(self.inv[i, j] * self.ricci[i, j]
                        for i in range(n) for j in range(n)))

    @cached_property
    def einstein(self) -> sp.Matrix:
        return (self.ricci - self.scalar * self.g / 2).applyfunc(simp)

    @cached_property
    def kretschmann(self) -> sp.Expr:
        """K = R_{abcd} R^{abcd} (raised one index at a time, O(n⁵) per step)."""
        n, gi = self.dim, self.inv
        T = self.riemann_lower
        for pos in range(4):
            U = _array((n,) * 4)
            for idx in sp.utilities.iterables.variations(range(n), 4, repetition=True):
                v = 0
                for k in range(n):
                    if gi[idx[pos], k] == 0:
                        continue
                    j = list(idx)
                    j[pos] = k
                    v += gi[idx[pos], k] * T[tuple(j)]
                U[idx] = simp(v) if v != 0 else 0
            T = U
        L = self.riemann_lower
        return simp(sum(L[i] * T[i] for i in
                        sp.utilities.iterables.variations(range(n), 4, repetition=True)))

    def gaussian_curvature(self) -> sp.Expr:
        """2D only: K = R/2 = R_{0101}/det g."""
        if self.dim != 2:
            raise MetricError("bad_dim", "Gaussian curvature is defined for 2D")
        return simp(self.scalar / 2)

    # --------------------------------------------------------- Levi-Civita
    def levi_civita_symbol(self) -> dict[tuple[int, ...], int]:
        """Nonzero components of the permutation symbol [i₁…iₙ]."""
        return {p: int(sp.LeviCivita(*p))
                for p in permutations(range(self.dim))}

    def levi_civita_lower(self) -> dict[tuple[int, ...], sp.Expr]:
        """ε_{i…} = √|g| [i…]."""
        s = self.sqrt_abs_det
        return {p: simp(v * s) for p, v in self.levi_civita_symbol().items()}

    def levi_civita_upper(self) -> dict[tuple[int, ...], sp.Expr]:
        """ε^{i…} = sign(g)/√|g| [i…], sign(g) = −1 for Lorentzian metrics."""
        sign = -1 if self.lorentzian else 1
        s = self.sqrt_abs_det
        return {p: simp(sign * v / s) for p, v in self.levi_civita_symbol().items()}

    # ------------------------------------------------------------ geodesics
    def velocity_symbols(self) -> tuple[sp.Symbol, ...]:
        return tuple(sp.Symbol("v_" + str(c)) for c in self.coords)

    def geodesic_rhs(self) -> list[sp.Expr]:
        """ẍ^λ = −Γ^λ_{μν} ẋ^μ ẋ^ν, with ẋ as :meth:`velocity_symbols`."""
        n, G, v = self.dim, self.christoffel, self.velocity_symbols()
        return [simp(-sum(G[l, m, k] * v[m] * v[k]
                          for m in range(n) for k in range(n)))
                for l in range(n)]
