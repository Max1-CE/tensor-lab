# Conventions

These are fixed across the symbolic kernel (`core/`), the numeric code (`web/src/numeric/`),
the theory cards and the tests. A test in `tests/test_core.py` pins each of them
(e.g. the sign of the sphere's scalar curvature catches swapped Riemann indices).

| Quantity | Definition | Code |
|---|---|---|
| Christoffel symbols (Levi-Civita connection) | $\Gamma^\lambda_{\mu\nu} = \tfrac12 g^{\lambda\sigma}(\partial_\mu g_{\sigma\nu} + \partial_\nu g_{\sigma\mu} - \partial_\sigma g_{\mu\nu})$ | `Metric.christoffel[l, m, n]` |
| Riemann tensor | $R^\rho{}_{\sigma\mu\nu} = \partial_\mu \Gamma^\rho_{\nu\sigma} - \partial_\nu \Gamma^\rho_{\mu\sigma} + \Gamma^\rho_{\mu\lambda}\Gamma^\lambda_{\nu\sigma} - \Gamma^\rho_{\nu\lambda}\Gamma^\lambda_{\mu\sigma}$ | `Metric.riemann[r, s, m, n]` |
| Lowered Riemann | $R_{\alpha\sigma\mu\nu} = g_{\alpha\rho} R^\rho{}_{\sigma\mu\nu}$ | `Metric.riemann_lower` |
| Ricci tensor | $R_{\sigma\nu} = R^\rho{}_{\sigma\rho\nu}$ | `Metric.ricci` |
| Scalar curvature | $R = g^{\sigma\nu} R_{\sigma\nu}$ | `Metric.scalar` |
| Einstein tensor | $G_{\mu\nu} = R_{\mu\nu} - \tfrac12 R\, g_{\mu\nu}$ | `Metric.einstein` |
| Kretschmann scalar | $K = R_{abcd} R^{abcd}$ | `Metric.kretschmann` |
| Levi-Civita tensor | $\varepsilon_{i_1\dots i_n} = \sqrt{\lvert g\rvert}\,[i_1\dots i_n]$, $\varepsilon^{i_1\dots i_n} = \tfrac{\operatorname{sgn} g}{\sqrt{\lvert g\rvert}}[i_1\dots i_n]$ | `levi_civita_lower/upper` |
| Geodesic equation | $\ddot x^\lambda + \Gamma^\lambda_{\mu\nu}\dot x^\mu \dot x^\nu = 0$ | `Metric.geodesic_rhs` |

* Signature for GR: $(-,+,+,+)$; units $G = c = 1$.
* With these conventions the unit sphere has $R = +2$ and $R_{\mu\nu} = +g_{\mu\nu}/a^2$.
* Independent components of $R_{abcd}$: $a<b$, $c<d$, $(a,b)\le(c,d)$; in 4D $R_{0312}$ is
  dropped (first Bianchi identity), giving $n^2(n^2-1)/12$ = 1, 6, 20 for $n$ = 2, 3, 4.
* $\sqrt{\lvert g\rvert}$ is taken on the chart's principal domain (e.g. $\theta\in(0,\pi)$),
  so $\sqrt{a^4\sin^2\theta} = a^2\sin\theta$.
* Array index order is always the order of the coordinates in the chart.
