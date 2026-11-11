// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Макс
/**
 * Theory cards. Text is Ukrainian; inline math is $…$, display math $$…$$.
 * Conventions match CONVENTIONS.md.
 */
import type { ToolId } from "../state/store";

export interface TheoryCard {
  title: string;
  body: string[];
  stage?: number; // the tool itself arrives at this stage
}

export const TOOL_CARDS: Record<ToolId, TheoryCard> = {
  frame: {
    title: "Базис і метрика",
    body: [
      "Точку площини задають координати $x^1, x^2$: $\\vec r = \\vec X(x^1, x^2)$.",
      "Локальний базис — дотичні до координатних ліній: $$\\vec e_i = \\frac{\\partial \\vec X}{\\partial x^i}.$$",
      "Метрика — це скалярні добутки базисних векторів: $$g_{ij} = \\vec e_i \\cdot \\vec e_j,$$ тож вона симетрична: $g_{12} = g_{21}$.",
      "Квадрат відстані між близькими точками: $$ds^2 = g_{ij}\\,dx^i dx^j$$ (за індексами, що повторюються, сумуємо — правило Ейнштейна).",
      "У декартових координатах $g_{ij} = \\delta_{ij}$. У косій системі з'являється $g_{12} = \\cos\\alpha \\ne 0$. У криволінійних системах $\\vec e_i$ і $g_{ij}$ залежать від точки.",
      "Тягни кінці $\\vec e_1, \\vec e_2$ і дивись, які компоненти $g_{ij}$ змінюються.",
    ],
  },
  metric: { title: "Метрика", stage: 3, body: ["$g_{ij}$, $g^{ij}$, $\\det g$ і елемент площі $\\sqrt{g}\\,dx^1dx^2$."] },
  length: { title: "Довжина кривої", stage: 3, body: ["$L = \\int \\sqrt{g_{ij}\\dot x^i \\dot x^j}\\,dt$ і геодезична між двома точками."] },
  vector: { title: "Ко- і контраваріантні компоненти", stage: 3, body: ["$v_i = g_{ij} v^j$, дуальний базис $\\vec e^{\\,i}$."] },
  angle: { title: "Кут і скалярний добуток", stage: 3, body: ["$\\cos\\theta = \\dfrac{g_{ij}u^i v^j}{|u|\\,|v|}$."] },
  christoffel: { title: "Символи Христоффеля", stage: 4, body: ["$\\Gamma^\\lambda_{\\mu\\nu} = \\tfrac12 g^{\\lambda\\sigma}(\\partial_\\mu g_{\\sigma\\nu} + \\partial_\\nu g_{\\sigma\\mu} - \\partial_\\sigma g_{\\mu\\nu})$."] },
  transport: { title: "Паралельне перенесення", stage: 4, body: ["$\\dot v^\\lambda + \\Gamma^\\lambda_{\\mu\\nu}\\dot x^\\mu v^\\nu = 0$."] },
  geodesic: { title: "Геодезичні", stage: 4, body: ["$\\ddot x^\\lambda + \\Gamma^\\lambda_{\\mu\\nu}\\dot x^\\mu \\dot x^\\nu = 0$."] },
  curvature: { title: "Кривина", stage: 4, body: ["Тензор Рімана, Річчі $R_{\\sigma\\nu} = R^\\rho{}_{\\sigma\\rho\\nu}$, скаляр $R$."] },
  symbols: { title: "Символи Кронекера і Леві-Чивіти", stage: 4, body: ["$\\delta^i_j$ і $\\varepsilon_{ijk} = \\sqrt{|g|}\\,[ijk]$."] },
};

/** Short notes about each preset chart, shown under the tool card. */
export const CHART_NOTES: Record<string, string> = {
  cartesian: "Декартова система: базис ортонормований і однаковий у всіх точках, $g_{ij} = \\delta_{ij}$, усі $\\Gamma = 0$.",
  skew: "Коса (афінна) система: $\\vec e_1, \\vec e_2$ сталі, але не перпендикулярні. Метрика стала, $\\Gamma = 0$, проте $g_{12} = \\cos\\alpha$.",
  polar: "Полярна система: $x = r\\cos\\phi,\\ y = r\\sin\\phi$. $|\\vec e_\\phi| = r$ росте з відстанню, тому $g_{\\phi\\phi} = r^2$. Площина та сама, $R = 0$, але $\\Gamma \\ne 0$.",
  elliptic: "Еліптична система: $x = a\\cosh\\mu\\cos\\nu,\\ y = a\\sinh\\mu\\sin\\nu$. Лінії $\\mu = $ const — еліпси, $\\nu = $ const — гіперболи зі спільними фокусами $(\\pm a, 0)$.",
  parabolic: "Параболічна система: $x = \\sigma\\tau,\\ y = \\tfrac12(\\tau^2 - \\sigma^2)$. Обидві родини ліній — параболи зі спільним фокусом у початку координат.",
  custom: "Своя метрика: символьне ядро (SymPy у браузері) рахує $g^{ij}$, $\\Gamma$, кривину; на полотні — індикатриси метрики.",
};
