"use client"

import { useEffect, useMemo, useState } from "react"
import { TrendingDown, TrendingUp, Wallet, PiggyBank, Plus, Target } from "lucide-react"
import { StatCard } from "@/components/stat-card"
import { useStore } from "@/lib/store"
import { currencySymbol } from "@/lib/types"
import { categoryLabel, type Language } from "@/lib/i18n"
import { useDesignPreview } from "@/lib/design-preview"

type Period = "diario" | "semanal" | "mensual"

// Objetivo de ahorro: de momento se guarda solo en este dispositivo
// (localStorage), no en Supabase — es parte del preview de diseño (ver
// lib/design-preview.ts). Si el resultado gusta, se pasa a la tabla
// user_preferences para que se sincronice entre dispositivos como el resto
// de ajustes.
const GOAL_STORAGE_KEY = "marcel-fit-coach:savings-goal"

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

function daysLeftInMonth(dateStr: string): number {
  const year = Number(dateStr.slice(0, 4))
  const month = Number(dateStr.slice(5, 7))
  const day = Number(dateStr.slice(8, 10))
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return Math.max(0, lastDay - day)
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
  const preview = useDesignPreview()

  const today = todayISO()
  const currentWeek = getWeekNumberFromISO(today)
  const currentMonth = today.slice(0, 7)
  const daysLeft = daysLeftInMonth(today)
  const daysLeftLabel =
    daysLeft <= 0
      ? t("overview.lastDayOfMonth")
      : `${daysLeft} ${daysLeft === 1 ? t("overview.dayLeft") : t("overview.daysLeft")}`

  // Objetivo de ahorro (solo preview, ver comentario de GOAL_STORAGE_KEY).
  const [goalAmount, setGoalAmount] = useState<number | null>(null)
  const [editingGoal, setEditingGoal] = useState(false)
  const [goalInput, setGoalInput] = useState("")

  useEffect(() => {
    const stored = localStorage.getItem(GOAL_STORAGE_KEY)
    if (stored) {
      const n = Number(stored)
      if (!Number.isNaN(n) && n > 0) setGoalAmount(n)
    }
  }, [])

  const startEditingGoal = () => {
    setGoalInput(goalAmount != null ? String(goalAmount) : "")
    setEditingGoal(true)
  }

  // Escribir 0 o dejarlo vacío quita el objetivo (vuelve a "+ Poner
  // objetivo"), para poder cancelarlo sin tener que borrar el campo a mano.
  const saveGoal = () => {
    const trimmed = goalInput.trim()
    const n = trimmed === "" ? 0 : Number(trimmed.replace(",", "."))
    if (Number.isNaN(n)) {
      setEditingGoal(false)
      setGoalInput("")
      return
    }
    if (n <= 0) {
      setGoalAmount(null)
      localStorage.removeItem(GOAL_STORAGE_KEY)
    } else {
      setGoalAmount(n)
      localStorage.setItem(GOAL_STORAGE_KEY, String(n))
    }
    setEditingGoal(false)
    setGoalInput("")
  }

  // Resumen fijo de arriba (solo en preview, ver lib/design-preview.ts):
  // balance del mes en curso, independiente del selector Diario/Semanal/
  // Mensual de más abajo, para que no cambie de número al cambiar de tab.
  // Se puede tocar la tarjeta para alternar entre el balance de este mes y
  // el ahorro total acumulado (todas las transacciones).
  const [balanceView, setBalanceView] = useState<"month" | "total">("month")
  const monthTx = useMemo(() => transactions.filter((t) => t.date.startsWith(currentMonth)), [transactions, currentMonth])
  const monthBalance = monthTx.reduce((s, t) => s + t.amount, 0)
  const totalBalance = useMemo(() => transactions.reduce((s, t) => s + t.amount, 0), [transactions])
  const displayedBalance = balanceView === "month" ? monthBalance : totalBalance
  const goalPct = goalAmount ? Math.min(100, Math.max(0, (monthBalance / goalAmount) * 100)) : 0
  const goalReached = goalAmount != null && monthBalance >= goalAmount

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
      {preview && (
        <p className="text-xs leading-snug" style={{ color: "oklch(0.22 0.05 150 / 88%)" }}>
          {t("overview.appSummary")}
        </p>
      )}

      {preview && (
        <button
          type="button"
          onClick={() => setBalanceView((v) => (v === "month" ? "total" : "month"))}
          className="w-full rounded-2xl p-4 text-left transition-opacity active:opacity-80"
          style={{ background: "oklch(1 0 0 / 14%)", backdropFilter: "blur(6px)" }}
        >
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: "oklch(0.22 0.05 150 / 75%)" }}>
                {balanceView === "month" ? t("overview.monthBalanceLabel") : t("overview.totalBalanceLabel")}
              </p>
              <p className="mt-0.5 text-2xl font-bold tabular-nums" style={{ color: "oklch(0.18 0.04 150)" }}>
                {displayedBalance >= 0 ? "+" : "-"}{symbol}{Math.abs(displayedBalance).toFixed(2)}
              </p>
            </div>
            <p className="shrink-0 text-xs font-medium" style={{ color: "oklch(0.22 0.05 150 / 70%)" }}>
              {balanceView === "month"
                ? daysLeftLabel
                : `${transactions.length} ${transactions.length === 1 ? t("common.movement") : t("common.movements")}`}
            </p>
          </div>
        </button>
      )}

      {preview && (
        <div className="rounded-2xl p-4" style={{ background: "oklch(1 0 0 / 14%)", backdropFilter: "blur(6px)" }}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Target className="size-3.5" style={{ color: "oklch(0.22 0.05 150 / 75%)" }} />
              <span className="text-[11px] font-medium uppercase tracking-wide" style={{ color: "oklch(0.22 0.05 150 / 75%)" }}>
                {t("overview.goalTitle")}
              </span>
            </div>
            {goalAmount != null && !editingGoal && (
              <button
                onClick={startEditingGoal}
                className="text-[11px] font-medium underline-offset-2 hover:underline"
                style={{ color: "oklch(0.22 0.05 150 / 70%)" }}
              >
                {t("overview.goalEdit")}
              </button>
            )}
          </div>

          {goalAmount == null && !editingGoal && (
            <button
              onClick={startEditingGoal}
              className="mt-2 text-xs font-medium underline-offset-2 hover:underline"
              style={{ color: "oklch(0.18 0.04 150)" }}
            >
              + {t("overview.goalSet")}
            </button>
          )}

          {editingGoal && (
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                min="0"
                inputMode="decimal"
                autoFocus
                value={goalInput}
                onChange={(e) => setGoalInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveGoal()}
                placeholder={t("overview.goalPlaceholder")}
                // text-base (16px): por debajo de 16px, Safari en iOS hace
                // zoom automático de toda la página al enfocar el campo —
                // "text-base" evita ese zoom (en pantallas grandes baja a
                // 14px con md:text-sm, donde el zoom de iOS no aplica).
                className="h-8 min-w-0 flex-1 rounded-md border-0 bg-white/50 px-2.5 text-base outline-none md:text-sm"
                style={{ color: "oklch(0.18 0.04 150)" }}
              />
              <button
                onClick={saveGoal}
                className="shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium text-white"
                style={{ backgroundColor: "oklch(0.4 0.1 150)" }}
              >
                {t("common.save")}
              </button>
            </div>
          )}

          {goalAmount != null && !editingGoal && (
            <div className="mt-2">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-semibold tabular-nums" style={{ color: "oklch(0.18 0.04 150)" }}>
                  {symbol}{Math.max(monthBalance, 0).toFixed(0)} / {symbol}{goalAmount.toFixed(0)}
                </span>
                <span className="text-[11px] font-medium" style={{ color: "oklch(0.22 0.05 150 / 70%)" }}>
                  {goalReached ? t("overview.goalReached") : `${Math.round(goalPct)}%`}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full" style={{ background: "oklch(0.22 0.05 150 / 15%)" }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${goalPct}%`, background: "oklch(0.4 0.12 150)" }}
                />
              </div>
            </div>
          )}
        </div>
      )}

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
