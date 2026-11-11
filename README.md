# Tensor Lab

*An interactive lab for tensor calculus and general relativity: drag the basis, watch the metric change.*

Інтерактивна лабораторія тензорного числення і ЗТВ за книгами Леонарда Саскінда
«Теоретичний мінімум: СТВ / ЗТВ». Темний екран, плавні анімації, усе можна тягати мишкою.

> **Статус:** етап 1 з 5 — символьне ядро і тести. Вебінтерфейс з'явиться на етапі 2.

## Архітектура

Символьні обчислення працюють за **гібридною** схемою:

| Що | Де | Коли |
|---|---|---|
| Готові системи: декартова, коса, полярна, еліптична, параболічна, сфера, тор, сідло, Шварцшильд | `core/` на CPython | під час збірки → `web/public/precomputed/*.json` |
| Довільна метрика з поля вводу | той самий `core/` у Pyodide (Web Worker) | ліниво, на вимогу |
| Числа: геодезичні, довжини, перенесення | TypeScript (RK4 / RK45) | кожен кадр |

Ядро повертає не лише LaTeX, а й JS-код (`sympy.jscode` + `cse`) для g_ij, g^ij, Γ і R.
Вебзастосунок компілює ці вирази один раз, і далі ними користуються числові інтегратори:
формули на екрані й числа в розрахунках беруться з одного джерела.

```
core/
  simplify.py   cancel → trigsimp → shortest form; is_zero(a − b); memoised
  metric.py     Metric: g, g⁻¹, det, √|g|, δ-check, Γ, Riemann, Ricci, R, G, K, ε, geodesics
  presets.py    built-in charts (metric = pullback Jᵀ J of the map into ℝ²/ℝ³)
  parse.py      user-typed metric → Metric (named error codes for the UI)
  export.py     JSON: LaTeX + JS function bodies
scripts/precompute.py
tests/test_core.py
```

## Конвенції

Див. [CONVENTIONS.md](CONVENTIONS.md). Коротко:
Γ^λ_{μν} = ½ g^{λσ}(∂_μ g_{σν} + ∂_ν g_{σμ} − ∂_σ g_{μν}),
R^ρ_{σμν} = ∂_μ Γ^ρ_{νσ} − ∂_ν Γ^ρ_{μσ} + Γ^ρ_{μλ}Γ^λ_{νσ} − Γ^ρ_{νλ}Γ^λ_{μσ},
R_{σν} = R^ρ_{σρν}, сигнатура (−,+,+,+), G = c = 1.

## Запуск

```bash
python -m pip install -e ".[dev]"
python -m pytest              # symbolic kernel tests
python scripts/precompute.py  # regenerate web/public/precomputed/
```

Що перевіряють тести:
- площина в полярних, еліптичних, параболічних координатах: R = 0, хоча Γ ≠ 0;
- сфера радіуса a: R = 2/a², R_{μν} = g_{μν}/a², G_{μν} ≡ 0 у 2D, Γ^θ_{φφ} = −sin θ cos θ;
- тор: K = cos v / (b(R + b cos v)), ∬K dA = 0 (Гаусс–Бонне);
- сідло: K < 0; 3-сфера: R = 6/a²;
- Шварцшильд: R_{μν} = 0, K = 48M²/r⁶; Мінковський у сферичних координатах: Ріман = 0;
- симетрії Рімана й перша тотожність Б'янкі; 1 / 6 / 20 незалежних компонент;
- ε_{ijk}ε^{imn} = δ^m_j δ^n_k − δ^n_j δ^m_k у криволінійних координатах;
- парсер довільної метрики й коди помилок; згенерований JS збігається з SymPy.

## Дорожня карта

1. ✅ Символьне ядро + тести
2. Полотно: сітка, перетягування початку координат і базисних векторів, живе g_ij
3. Інструменти: метрика, довжина кривої, ко-/контраваріантні компоненти, кут
4. Інструменти: Христоффель, паралельне перенесення, геодезичні, кривина, δ та ε
5. Сторінка ЗТВ: Шварцшильд, діаграма вкладення Фламма, r = 2M / 3M / 6M

## License

Copyright (c) 2026 Макс. Licensed under the MIT License — see [LICENSE](LICENSE).

Parts of this project were written with the help of Claude (Anthropic) and reviewed and edited by the author.
