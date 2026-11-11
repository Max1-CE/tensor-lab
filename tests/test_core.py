# SPDX-License-Identifier: MIT
# Copyright (c) 2026 Макс
"""Tests of the symbolic kernel on metrics with known answers."""
from __future__ import annotations

import json
import math
import shutil
import subprocess
from itertools import permutations, product

import pytest
import sympy as sp

from core import Metric, MetricError, analyze, analyze_strings, equal, is_zero, parse_metric
from core.export import js_body
from core.presets import PRESETS

r, a, M, b, R0, k = sp.symbols("r a M b R k", positive=True)
t, th, ph, u, v, chi = sp.symbols("t theta phi u v chi", real=True)


def preset(pid: str) -> Metric:
    return PRESETS[pid].metric()


def nonzero_gamma(m: Metric) -> dict[tuple[int, int, int], sp.Expr]:
    return {(l, i, j): e for l, i, j, e in m.christoffel_nonzero()}


def all_riemann_zero(m: Metric) -> bool:
    n = m.dim
    return all(m.riemann[idx] == 0 for idx in product(range(n), repeat=4))


# ------------------------------------------------------------------ flat 2D
def test_polar_flat_but_christoffel_nonzero():
    m = preset("polar")
    assert m.kronecker_check()
    G = nonzero_gamma(m)
    assert set(G) == {(0, 1, 1), (1, 0, 1)}
    assert equal(G[0, 1, 1], -r)            # Γ^r_{φφ} = −r
    assert equal(G[1, 0, 1], 1 / r)         # Γ^φ_{rφ} = 1/r
    assert equal(m.christoffel[1, 1, 0], 1 / r)  # lower symmetry
    assert all_riemann_zero(m)
    assert m.scalar == 0
    assert equal(m.sqrt_abs_det, r)


@pytest.mark.parametrize("pid", ["cartesian", "skew", "polar", "elliptic", "parabolic"])
def test_plane_charts_are_flat(pid):
    m = preset(pid)
    assert m.kronecker_check()
    assert all_riemann_zero(m)
    assert m.scalar == 0


@pytest.mark.parametrize("pid", ["cartesian", "skew"])
def test_affine_charts_have_no_christoffel(pid):
    assert preset(pid).christoffel_nonzero() == []


def test_skew_metric_is_dot_products_of_basis():
    m = preset("skew")
    alpha = next(iter(PRESETS["skew"].params))
    assert m.g == sp.Matrix([[1, sp.cos(alpha)], [sp.cos(alpha), 1]])


def test_elliptic_metric_simplified():
    m = preset("elliptic")
    mu, nu = m.coords
    aa = next(iter(PRESETS["elliptic"].params))
    expected = aa**2 * (sp.sinh(mu) ** 2 + sp.sin(nu) ** 2)
    assert equal(m.g[0, 0], expected) and equal(m.g[1, 1], expected)
    assert m.g[0, 1] == 0
    assert len(m.christoffel_nonzero()) > 0


# ------------------------------------------------------------------ sphere
def test_sphere_curvature():
    m = preset("sphere")
    assert m.kronecker_check()
    assert equal(m.scalar, 2 / a**2)
    assert equal(m.gaussian_curvature(), 1 / a**2)
    assert equal(m.riemann_lower[0, 1, 0, 1], a**2 * sp.sin(th) ** 2)
    assert equal(m.riemann[0, 1, 0, 1], sp.sin(th) ** 2)  # R^θ_{φθφ}
    for i, j in product(range(2), repeat=2):
        assert is_zero(m.ricci[i, j] - m.g[i, j] / a**2)
    assert m.einstein == sp.zeros(2, 2)  # G_{μν} ≡ 0 in two dimensions
    assert equal(m.sqrt_abs_det, a**2 * sp.sin(th))


def test_sphere_christoffel_textbook_form():
    G = nonzero_gamma(preset("sphere"))
    assert set(G) == {(0, 1, 1), (1, 0, 1)}
    assert G[0, 1, 1] == -sp.sin(th) * sp.cos(th)
    assert G[1, 0, 1] == sp.cot(th)


def test_sphere_geodesic_equations():
    m = preset("sphere")
    vth, vph = m.velocity_symbols()
    acc = m.geodesic_rhs()
    assert equal(acc[0], sp.sin(th) * sp.cos(th) * vph**2)
    assert equal(acc[1], -2 * sp.cot(th) * vth * vph)


# ------------------------------------------------------------ other surfaces
def test_torus_gaussian_curvature_and_gauss_bonnet():
    m = preset("torus")
    K = m.gaussian_curvature()
    assert equal(K, sp.cos(v) / (b * (R0 + b * sp.cos(v))))
    total = sp.integrate(sp.integrate(K * m.sqrt_abs_det, (u, 0, 2 * sp.pi)),
                         (v, 0, 2 * sp.pi))
    assert sp.simplify(total) == 0  # χ(torus) = 0


def test_saddle_negative_curvature():
    m = preset("saddle")
    assert equal(m.gaussian_curvature(), -k**2 / (1 + k**2 * (u**2 + v**2)) ** 2)


def test_three_sphere():
    m = Metric((chi, th, ph), sp.diag(a**2, a**2 * sp.sin(chi) ** 2,
                                      a**2 * sp.sin(chi) ** 2 * sp.sin(th) ** 2))
    assert equal(m.scalar, 6 / a**2)
    check_riemann_symmetries(m)


# -------------------------------------------------------------- spacetime
def test_schwarzschild_vacuum():
    m = preset("schwarzschild")
    assert m.kronecker_check()
    assert m.ricci == sp.zeros(4, 4)
    assert m.einstein == sp.zeros(4, 4)
    assert m.scalar == 0
    assert equal(m.kretschmann, 48 * M**2 / r**6)
    assert equal(m.christoffel[1, 0, 0], M * (r - 2 * M) / r**3)  # Γ^r_{tt}
    assert equal(m.christoffel[0, 0, 1], M / (r * (r - 2 * M)))    # Γ^t_{tr}
    assert not all_riemann_zero(m)
    check_riemann_symmetries(m)


def test_minkowski_spherical_flat():
    f = sp.diag(-1, 1, r**2, r**2 * sp.sin(th) ** 2)
    m = Metric((t, r, th, ph), f, lorentzian=True)
    assert len(m.christoffel_nonzero()) > 0
    assert all_riemann_zero(m)
    assert equal(m.sqrt_abs_det, r**2 * sp.sin(th))


def check_riemann_symmetries(m: Metric) -> None:
    n, L = m.dim, m.riemann_lower
    for i, j, p, q in product(range(n), repeat=4):
        assert is_zero(L[i, j, p, q] + L[j, i, p, q])
        assert is_zero(L[i, j, p, q] + L[i, j, q, p])
        assert is_zero(L[i, j, p, q] - L[p, q, i, j])
        assert is_zero(L[i, j, p, q] + L[i, p, q, j] + L[i, q, j, p])  # Bianchi I


@pytest.mark.parametrize("n,count", [(2, 1), (3, 6), (4, 20)])
def test_independent_riemann_count(n, count):
    idx = Metric.independent_index_set(n)
    assert len(idx) == count == n**2 * (n**2 - 1) // 12
    assert len(set(idx)) == count


# -------------------------------------------------------------- Levi-Civita
def _delta(i, j):
    return 1 if i == j else 0


def test_levi_civita_full_contraction():
    for pid, sign in (("sphere", 1), ("polar", 1), ("schwarzschild", -1)):
        m = preset(pid)
        lo, up = m.levi_civita_lower(), m.levi_civita_upper()
        total = sum(lo[p] * up[p] for p in lo)
        assert equal(total, sign * math.factorial(m.dim)), pid


def test_levi_civita_epsilon_delta_identity_curvilinear():
    # ε_{ijk} ε^{imn} = δ^m_j δ^n_k − δ^n_j δ^m_k in spherical coordinates
    m = Metric((r, th, ph), sp.diag(1, r**2, r**2 * sp.sin(th) ** 2))
    lo, up = m.levi_civita_lower(), m.levi_civita_upper()

    def e(d, idx):
        return d.get(tuple(idx), 0)

    for j, kk, mm, nn in product(range(3), repeat=4):
        lhs = sum(e(lo, (i, j, kk)) * e(up, (i, mm, nn)) for i in range(3))
        rhs = _delta(mm, j) * _delta(nn, kk) - _delta(nn, j) * _delta(mm, kk)
        assert is_zero(lhs - rhs)


def test_levi_civita_symbol_values():
    m = preset("sphere")
    s = m.levi_civita_symbol()
    assert s[(0, 1)] == 1 and s[(1, 0)] == -1
    assert set(s) == set(permutations(range(2)))


# -------------------------------------------------------------------- parse
def test_parse_polar_with_implicit_multiplication():
    m = parse_metric(["r", "theta"], [["1", "0"], ["0", "r^2"]])
    assert equal(m.christoffel[0, 1, 1], -m.coords[0])
    m2 = parse_metric(["theta", "phi"], [["a^2", "0"], ["0", "a^2 sin(theta)^2"]],
                      params=["a"])
    assert equal(m2.scalar, 2 / sp.Symbol("a", positive=True) ** 2)


@pytest.mark.parametrize("coords,g,code", [
    (["x", "y"], [["1", "x"], ["0", "1"]], "not_symmetric"),
    (["x", "y"], [["1", "1"], ["1", "1"]], "degenerate"),
    (["x", "y"], [["1", "0"], ["0", "q"]], "unknown_symbol"),
    (["x", "y"], [["1", "0"], ["0", "(("]], "parse"),
    (["x", "sin"], [["1", "0"], ["0", "1"]], "bad_name"),
    (["x"], [["1"]], "bad_dim"),
    (["x", "y"], [["1", "0"]], "not_square"),
])
def test_parse_errors(coords, g, code):
    with pytest.raises(MetricError) as err:
        parse_metric(coords, g)
    assert err.value.code == code


def test_analyze_strings_cached_and_params_detected():
    g = [["a^2", "0"], ["0", "a^2 sin(theta)^2"]]
    d1 = analyze_strings(["theta", "phi"], g)
    d2 = analyze_strings(["theta", "phi"], g)
    assert d1 is d2
    assert [p["name"] for p in d1["params"]] == ["a"]
    assert d1["scalar"] == r"\frac{2}{a^{2}}"


# ------------------------------------------------------------------- export
@pytest.mark.parametrize("pid", list(PRESETS))
def test_export_all_presets(pid):
    p = PRESETS[pid]
    d = analyze(p.metric(), p.params, embedding=p.embedding)
    json.dumps(d)
    assert d["kroneckerOk"]
    assert d["riemann"]["independentCount"] == {2: 1, 4: 20}[d["dim"]]
    assert set(d["js"]) >= {"metric", "inverse", "christoffel", "scalar"}


def test_line_element_latex():
    d = analyze(preset("polar"))
    assert d["lineElement"] == r"ds^{2} = dr^{2} + r^{2}\,d\phi^{2}"


@pytest.mark.skipif(shutil.which("node") is None, reason="node not installed")
def test_js_codegen_matches_sympy():
    p = PRESETS["torus"]
    m = p.metric()
    psyms = sorted(p.params, key=str)
    body = js_body(m, psyms, list(m.christoffel.reshape(8)) + [m.scalar])
    x = [0.7, 1.3]
    params = {str(s): val for s, val in p.params.items()}
    script = (f"const f = new Function('x','p', {json.dumps(body)});"
              f"console.log(JSON.stringify(f({json.dumps(x)}, {json.dumps(params)})));")
    out = json.loads(subprocess.run(["node", "-e", script], capture_output=True,
                                    text=True, check=True).stdout)
    subs = {m.coords[0]: x[0], m.coords[1]: x[1], **p.params}
    want = [float(e.subs(subs)) for e in list(m.christoffel.reshape(8)) + [m.scalar]]
    assert out == pytest.approx(want, rel=1e-12, abs=1e-12)
