# Tensor Lab

*An interactive lab for tensor calculus and general relativity: drag the basis, watch the metric change.*

Інтерактивна лабораторія тензорного числення і ЗТВ за книгами Леонарда Саскінда
«Теоретичний мінімум: СТВ / ЗТВ». Темний екран, плавні анімації, усе можна тягати мишкою.

**Демо:** https://max1-ce.github.io/tensor-lab/

> **Статус:** етап 4 з 5 — сторінка «Геометрія» завершена: 9 інструментів, площина й поверхні. Далі — сторінка ЗТВ.

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
web/src/
  symbolic/   worker.ts (Pyodide + core/*.py), client.ts (Comlink), compile.ts, presets.ts
  geometry/   linalg, chart (frame A, pullback metric, inverse map), grid (+ morph), viewport
  canvas/     GridLayer — coordinate lines, basis field, indicatrices
  overlay/    Overlay — draggable O, P, e₁, e₂ (SVG)
  numeric/    ode (RK4, Dormand–Prince RK45), field (g, Γ), curves (length, geodesic shooting),
              transport (parallel transport, holonomy, ∬K dA, geodesic fans and deviation)
  tools/      compute, compute2 — derived quantities of tools 1–9 (memoised, shared by canvas and panels)
  ui/, theory/, i18n/uk.ts, state/store.ts (Zustand)
```

## Конвенції

Див. [CONVENTIONS.md](CONVENTIONS.md). Коротко:
Γ^λ_{μν} = ½ g^{λσ}(∂_μ g_{σν} + ∂_ν g_{σμ} − ∂_σ g_{μν}),
R^ρ_{σμν} = ∂_μ Γ^ρ_{νσ} − ∂_ν Γ^ρ_{μσ} + Γ^ρ_{μλ}Γ^λ_{νσ} − Γ^ρ_{νλ}Γ^λ_{μσ},
R_{σν} = R^ρ_{σρν}, сигнатура (−,+,+,+), G = c = 1.

## Що вже вміє сторінка «Геометрія»

- Сітки декартової, косої, полярної, еліптичної й параболічної систем; перемикання — плавний морфінг ліній.
- Перетягування початку координат O, точки P і кінців базисних векторів e₁, e₂: сітка деформується
  лінійно, а g_ij = e_i · e_j оновлюється наживо (змінені компоненти підсвічуються).
- Поле локальних базисів ∂/∂xⁱ у вузлах сітки; лінії xⁱ = const через P.
- Довільна метрика g_ij(x¹, x²): SymPy у браузері (Pyodide) рахує все символьно, полотно показує
  індикатриси метрики (еліпси g_ij dxⁱdxʲ = ε²).
- **Інструменти** (кожен зі своєю карткою теорії):
  1. *Метрика* — g_ij, g^ij, перевірка g^ik g_kj = δ^i_j, det g, √g; координатна клітинка і її
     лінійне наближення √g dx¹dx² (видно збіжність при dx → 0).
  2. *Довжина* — точки A, B: довжина «прямої в координатах» L = ∫√(g_ij ẋⁱẋʲ) dt (Гаусс–Лежандр)
     і геодезична, знайдена методом стрільби (RK4 + Ньютон); для плоских систем вона дорівнює |AB|.
  3. *Вектор* — vⁱ (паралелограм) і v_i = g_ij vʲ, дуальний базис eⁱ = g^ij e_j, перпендикуляри.
  4. *Кут* — g_ij uⁱwʲ, cos θ; порівняння з видимим кутом (для своєї метрики вони різні).
  5. *Христоффель* — таблиця ненульових Γ (символьно й у точці P); ∂ⱼeᵢ = Γᵏᵢⱼ eₖ порівнюється
     з реальною зміною базису при зсуві точки.
  6. *Паралельне перенесення* — вздовж кола або лінії x¹ = const (з анімацією); кут повороту
     (голономія) порівнюється з ∬K dA — на сфері виходить 2π(1 − cos θ).
  7. *Геодезичні* — пучок з точки P (RK4, одинична швидкість), графік відхилення сусідніх
     геодезичних: sin s на сфері, s на площині, sinh s на сідлі.
  8. *Кривина* — теплова карта R(x) (дивергентна шкала), символьні Ріман, Річчі, R, K, Ейнштейн,
     скаляр Кречмана; значення під курсором.
  9. *δ і ε* — таблиці δⁱⱼ, [ij], [ijk], тотожності δⁱᵢ = n, ε_ij ε^ij = 2, ε_ijk ε^imn = δδ − δδ
     (вибір індексів, перевірка всіх 81 комбінацій), ε_ij uⁱwʲ як орієнтована площа.
- **Поверхні:** сфера, тор, сідло з метрикою, індукованою вкладенням — карта координат на
  полотні і маленьке 3D-вікно вкладення (обертається мишкою) з кривими поточного інструмента.
- Висувна панель теорії з формулами KaTeX. Клавіші: T — теорія, R — скинути базис, F — поле базисів;
  Shift — прив'язка до сітки, коліщатко — масштаб.

## Запуск

```bash
# symbolic kernel
python -m pip install -r requirements-dev.txt
python -m pytest              # symbolic kernel tests
python scripts/precompute.py  # regenerate web/public/precomputed/

# web app
cd web
npm install
npm run dev                   # http://localhost:5173
npm test                      # Vitest (numeric/geometry)
npm run build                 # type-check + production build into web/dist
npm run smoke:pyodide         # run core/*.py under Pyodide in Node
```

CI запускає pytest, Vitest і збірку, а потім публікує `web/dist` на GitHub Pages.

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
2. ✅ Полотно: сітка, перетягування початку координат і базисних векторів, живе g_ij
3. ✅ Інструменти: метрика, довжина кривої, ко-/контраваріантні компоненти, кут
4. ✅ Інструменти: Христоффель, паралельне перенесення, геодезичні, кривина, δ та ε
5. Сторінка ЗТВ: Шварцшильд, діаграма вкладення Фламма, r = 2M / 3M / 6M

## License

Copyright (c) 2026 Макс. Licensed under the MIT License — see [LICENSE](LICENSE).

Parts of this project were written with the help of Claude (Anthropic) and reviewed and edited by the author.
