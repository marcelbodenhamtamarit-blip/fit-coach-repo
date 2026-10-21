// Agregados reales (nada de datos de ejemplo) usados por el Árbol de Gastos
// y por el apartado de IA Timmy — ambos solo visibles para la cuenta en
// lib/redesign-beta.ts. Todo se calcula aquí a partir de data.transactions
// (useStore()), nunca con cifras inventadas.
import type { Transaction, TransactionCategory } from "./types"

export const CATEGORY_ICON: Record<TransactionCategory, string> = {
  Alojamiento: "🏠",
  Supermercado: "🛒",
  "Comida fuera": "🍜",
  Transporte: "🚌",
  Salario: "💼",
  Compras: "🛍️",
  Necesidades: "🧻",
  Ocio: "🎉",
  Otros: "📦",
}

// Paleta ramas del árbol: lima/esmeralda para marca y dinero, el resto en
// colores distintos entre sí para que cada rama se reconozca a simple
// vista. --ai (morado) queda reservado solo para la superficie de Timmy.
export const CATEGORY_COLOR: Record<TransactionCategory, string> = {
  Alojamiento: "#38bdf8",
  Supermercado: "#a3e635",
  "Comida fuera": "#f59e0b",
  Transporte: "#22d3ee",
  Salario: "#4ade80",
  Compras: "#c084fc",
  Necesidades: "#f472b6",
  Ocio: "#facc15",
  Otros: "#94a3b8",
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
