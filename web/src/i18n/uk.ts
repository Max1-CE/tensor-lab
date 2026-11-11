// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Макс
/** All user-facing strings (Ukrainian). */
import type { ToolId } from "../state/store";

export const uk = {
  appName: "Tensor Lab",
  pages: { geometry: "Геометрія", gr: "ЗТВ" },
  theory: "Теорія",
  close: "Закрити",
  soon: (stage: number) => `з'явиться на етапі ${stage}`,

  tools: {
    frame: "Базис",
    metric: "Метрика",
    length: "Довжина",
    vector: "Вектор",
    angle: "Кут",
    christoffel: "Христоффель",
    transport: "Перенесення",
    geodesic: "Геодезичні",
    curvature: "Кривина",
    symbols: "δ і ε",
  } satisfies Record<ToolId, string>,

  panel: {
    system: "Система координат",
    custom: "Своя метрика",
    params: "Параметри",
    field: "Поле базисів ∂/∂xⁱ",
    reset: "Скинути базис",
    metricAt: "Метрика в точці P",
    metricConst: "Метрика (стала)",
    point: "Точка P",
    abstractNote:
      "Довільну метрику показано на площині координат. Еліпси — «одиничні кола» метрики: $g_{ij}\\,dx^i dx^j = \\varepsilon^2$.",
    frameNote:
      "Тягни кінці $\\vec e_1, \\vec e_2$ — сітка деформується лінійно, $g_{ij} = \\vec e_i \\cdot \\vec e_j$. Shift — прив'язка до сітки, коліщатко — масштаб.",
    frameChanged:
      "Базис змінено лінійним перетворенням $A$: $g_{ij} = \\partial_i \\vec X^{\\mathsf T} G\\, \\partial_j \\vec X$, де",
    loading: "Завантаження…",
  },

  custom: {
    coords: "Координати",
    domain: "Діапазон",
    compute: "Обчислити",
    computing: "Обчислюю…",
    warming: "Python готується у фоні:",
    hint: "Синтаксис: a^2 sin(theta)^2, exp(2*x), 1/(1+x^2). Невідомі імена стають параметрами (=1).",
    stages: {
      runtime: "Завантажую Python (Pyodide, ~10 МБ)…",
      sympy: "Завантажую SymPy…",
      kernel: "Готую символьне ядро…",
      ready: "Рахую тензори…",
    },
    errors: {
      parse: "Не вдалося розібрати вираз",
      not_symmetric: "Метрика має бути симетричною: g₁₂ = g₂₁",
      degenerate: "det g = 0 — метрика вироджена",
      unknown_symbol: "Невідомий символ",
      bad_name: "Недопустима назва координати",
      bad_dim: "Потрібно 2–4 координати",
      not_square: "Матриця має бути квадратною",
      duplicate_coords: "Координати мають різні назви",
      worker_failed: "Не вдалося запустити Python у браузері (немає мережі?)",
      internal: "Внутрішня помилка обчислень",
    } as Record<string, string>,
  },

  gr: {
    title: "Загальна теорія відносності",
    soon: "Сторінка ЗТВ (метрика Шварцшильда, діаграма Фламма, r = 2M, 3M, 6M) з'явиться на етапі 5.",
  },
};
