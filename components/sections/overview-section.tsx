"use client"

import { useMemo, useState } from "react"
import { TrendingDown, TrendingUp, Wallet, PiggyBank, Plus } from "lucide-react"
import { StatCard } from "@/components/stat-card"
import { useStore } from "@/lib/store"
import { currencySymbol } from "@/lib/types"
import { categoryLabel, type Language } from "@/lib/i18n"

type Period = "diario" | "semanal" | "mensual"

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function getWeekNumberFromISO(dateStr: string): number {
  const date = new Date(dateStr + "T00:00:00Z")
  const jan4 = new Date(Date.UTC(date.getUTCFullYear(), 0, 4))
  const dayOfWeek = jan4.getUTCDay()
  const week1Start = new Date(jan4)
  week1Start.setUTCDate(jan4.getUTCDate() - dayOfWeek)
  const diffDays = Math.floor((date.getTime() - week1Start.getTime()) / (24 * 60 * 60 * 1000))
  return 1 + Math.floor(diffDays / 7)
}

export function OverviewSection({
  onNavigate,
  onAddExpense,
}: {
  onNavigate: (tab: string) => void
  onAddExpense: () => void
}) {
  const { data, t } = useStore()
  const lang = (data.language as Language) ?? "es"
  const transactions = data.transactions ?? []
  const symbol = currencySymbol(data.homeCurrency)
  const [period, setPeriod] = useState<Period>("diario")

  const today = todayISO()
  const currentWeek = getWeekNumberFromISO(today)
  const currentMonth = today.slice(0, 7)

  const inPeriod = (dateStr: string) => {
    if (period === "diario") return dateStr === today
    if (period === "semanal") return getWeekNumberFromISO(dateStr) === currentWeek
    return dateStr.startsWith(currentMonth)
  }

  const periodTx = useMemo(() => transactions.filter((t) => inPeriod(t.date)), [transactions, period, today])
  const spent = periodTx.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
  const income = periodTx.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0)
  const balance = income - spent

  // Categoría con más gasto en el periodo seleccionado (sustituye a las
  // antiguas tarjetas de pasos/sueño de Garmin, que solo tenían sentido
  // para una cuenta y no tienen cabida en una app multiusuario).
  const topCategory = useMemo(() => {
    const byCat = new Map<string, number>()
    for (const t of periodTx) {
      if (t.amount >= 0) continue
      byCat.set(t.category, (byCat.get(t.category) ?? 0) + Math.abs(t.amount))
    }
    let best: { category: string; total: number } | null = null
    for (const [category, total] of byCat) {
      if (!best || total > best.total) best = { category, total }
    }
    return best
  }, [periodTx])

  const locale = lang === "en" ? "en-US" : "es-ES"
  const periodLabel =
    period === "diario"
      ? new Date().toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })
      : period === "semanal"
        ? t("economy.week", { n: currentWeek })
        : new Date().toLocaleDateString(locale, { month: "long", year: "numeric" })

  const movementsCount = periodTx.filter((t) => t.amount < 0).length
  const movementsLabel = `${movementsCount} ${movementsCount === 1 ? t("common.movement") : t("common.movements")}`

  return (
    <div className="space-y-5">
      <button
        onClick={onAddExpense}
        className="flex w-full items-center justify-center rounded-lg py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        style={{ backgroundColor: "#7c6fff" }}
      >
        <Plus className="mr-2 size-4" />
        {t("economy.addButton")}
      </button>

      <div className="flex gap-1 rounded-lg border border-border bg-muted/40 p-1">
        {[
          { id: "diario", label: t("common.daily") },
          { id: "semanal", label: t("common.weekly") },
          { id: "mensual", label: t("common.monthly") },
        ].map((p) => (
          <button
            key={p.id}
            onClick={() => setPeriod(p.id as Period)}
            className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
              period === p.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <p className="text-xs font-medium capitalize text-muted-foreground">{periodLabel}</p>

      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => onNavigate("economy")} className="text-left">
          <StatCard
            icon={TrendingDown}
            label={t("overview.spent")}
            value={`-${symbol}${spent.toFixed(2)}`}
            sub={movementsLabel}
            accent="red"
          />
        </button>

        <button onClick={() => onNavigate("economy")} className="text-left">
          <StatCard
            icon={TrendingUp}
            label={t("overview.income")}
            value={`+${symbol}${income.toFixed(2)}`}
            sub={income > 0 ? t("overview.registered") : t("overview.noIncome")}
            accent="green"
          />
        </button>

        <button onClick={() => onNavigate("economy")} className="text-left">
          <StatCard
            icon={Wallet}
            label={t("overview.balance")}
            value={`${balance >= 0 ? "+" : "-"}${symbol}${Math.abs(balance).toFixed(2)}`}
            sub={period === "diario" ? t("overview.today") : period === "semanal" ? t("overview.thisWeek") : t("overview.thisMonth")}
            accent={balance >= 0 ? "primary" : "amber"}
          />
        </button>

        <button onClick={() => onNavigate("economy")} className="text-left">
          <StatCard
            icon={PiggyBank}
            label={t("overview.topCategory")}
            value={topCategory ? categoryLabel(topCategory.category, lang) : "--"}
            sub={topCategory ? `-${symbol}${topCategory.total.toFixed(2)}` : t("overview.noExpenses")}
            accent="pink"
          />
        </button>
      </div>
    </div>
  )
}
