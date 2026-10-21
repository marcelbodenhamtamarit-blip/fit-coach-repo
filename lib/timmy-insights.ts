// Agregados reales (nada de datos de ejemplo) usados por el Árbol de Gastos
// y por el apartado de IA Timmy — ambos solo visibles para la cuenta en
// lib/redesign-beta.ts. Todo se calcula aquí a partir de data.transactions
// (useStore()), nunca con cifras inventadas.
import type { Transaction, TransactionCategory } from "./types"

// Mismo emoji y mismo color que ya usa Economía por categoría (ver
// CATEGORY_EMOJI/CATEGORY_COLOR en components/sections/economy-section.tsx):
// antes el Árbol tenía su propia paleta inventada, y una misma categoría
// (p.ej. Transporte) salía con un icono y un color distintos en Economía y
// en el Árbol — confuso para reconocerla de un vistazo entre pantallas. Se
// duplican los valores aquí en vez de importar desde economy-section.tsx
// para no arrastrar ese componente (formularios, recharts, etc.) a un
// módulo de lib/; si en el futuro se tocan los colores de categoría, hay
// que actualizar los dos sitios a la vez.
export const CATEGORY_ICON: Record<TransactionCategory, string> = {
  Alojamiento: "🏠",
  Supermercado: "🛒",
  "Comida fuera": "🍽️",
  Transporte: "🚗",
  Salario: "💰",
  Compras: "🛍️",
  Necesidades: "🧾",
  Ocio: "🎬",
  Otros: "📌",
}

export const CATEGORY_COLOR: Record<TransactionCategory, string> = {
  Alojamiento: "#fbbf24",
  Supermercado: "#2dd4bf",
  "Comida fuera": "#fb7185",
  Transporte: "#60a5fa",
  Salario: "#34d399",
  Compras: "#c084fc",
  Necesidades: "#f87171",
  Ocio: "#a78bfa",
  Otros: "#8a8a93",
}

export type CategoryBreakdown = {
  category: TransactionCategory
  amount: number
  icon: string
  color: string
  transactions: Transaction[]
}

export type MonthInsights = {
  categories: CategoryBreakdown[]
  income: number
  expense: number
  net: number
}

// monthKey: "YYYY-MM" (mismo formato que usan Resumen/Economía para filtrar
// por mes en curso).
export function breakdownForMonth(transactions: Transaction[], monthKey: string): MonthInsights {
  const inMonth = transactions.filter((t) => t.date.startsWith(monthKey))
  const income = inMonth.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0)
  const expenseTx = inMonth.filter((t) => t.amount < 0)

  const byCat = new Map<string, Transaction[]>()
  for (const t of expenseTx) {
    const arr = byCat.get(t.category) ?? []
    arr.push(t)
    byCat.set(t.category, arr)
  }

  const categories: CategoryBreakdown[] = Array.from(byCat.entries())
    .map(([category, txs]) => ({
      category: category as TransactionCategory,
      amount: txs.reduce((s, t) => s + Math.abs(t.amount), 0),
      icon: CATEGORY_ICON[category as TransactionCategory] ?? "📦",
      color: CATEGORY_COLOR[category as TransactionCategory] ?? "#94a3b8",
      transactions: txs.slice().sort((a, b) => b.date.localeCompare(a.date)),
    }))
    .sort((a, b) => b.amount - a.amount)

  const expense = categories.reduce((s, c) => s + c.amount, 0)

  return { categories, income, expense, net: income - expense }
}

// Heurística de respaldo si Gemini no responde (API key no configurada,
// timeout, error de red): un 12% del gasto de cada categoría como margen de
// reducción orientativo, para que el Árbol/Timmy nunca se queden sin plan
// que mostrar aunque la IA falle. Igual de "no romper nada" que el patrón ya
// usado en app/api/quick-transaction/route.ts para inferCategoryWithAI.
export function fallbackReduction(amount: number): number {
  return Math.round(amount * 0.12)
}
