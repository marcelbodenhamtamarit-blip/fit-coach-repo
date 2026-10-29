"use client"

// Inversiones (PIAS, Revolut, criptomonedas...), aparte de Economía: ver
// lib/investments-store.tsx para el porqué de un provider separado y
// supabase-migrations/investments.sql para el esquema. Entrada 100% manual
// -- no hay precio en vivo de nada -- así que lo único que hace esta
// pantalla es dejar guardar "cuánto vale esto ahora" y, con el historial de
// aportaciones/retiradas, calcular ganancia/pérdida real.
import { useEffect, useMemo, useState } from "react"
import {
  ChevronDown,
  Plus,
  Pencil,
  Trash2,
  Landmark,
  CreditCard,
  Bitcoin,
  Coins,
  TrendingUp,
  TrendingDown,
  X,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useStore } from "@/lib/store"
import { useInvestments } from "@/lib/investments-store"
import { supabase } from "@/lib/supabase"
import { convertAmount } from "@/lib/exchange-rates"
import {
  CURRENCIES,
  currencySymbol,
  INVESTMENT_TYPES,
  investmentGain,
  investmentNetContributed,
  type Investment,
  type InvestmentType,
} from "@/lib/types"
import { type Language } from "@/lib/i18n"

const TYPE_ICON: Record<InvestmentType, typeof Landmark> = {
  pias: Landmark,
  revolut: CreditCard,
  crypto: Bitcoin,
  other: Coins,
}

function fmt(amount: number, currency: string): string {
  const symbol = currencySymbol(currency)
  return `${amount >= 0 ? "" : "-"}${symbol}${Math.abs(amount).toFixed(2)}`
}

export function InvestmentsSection() {
  const { data, t } = useStore()
  const lang = (data.language as Language) ?? "es"
  const homeCurrency = data.homeCurrency
  const symbol = currencySymbol(homeCurrency)
  const {
    investments,
    contributions,
    ready,
    addInvestment,
    renameInvestment,
    updateInvestmentValue,
    archiveInvestment,
    deleteInvestment,
    addContribution,
    deleteContribution,
  } = useInvestments()

  const active = useMemo(() => investments.filter((i) => !i.archived), [investments])
  const archived = useMemo(() => investments.filter((i) => i.archived), [investments])

  // Patrimonio total = ahorro ya calculado en Economía (suma de todas las
  // transacciones, en homeCurrency) + lo que valen las inversiones activas
  // ahora mismo, convertido a homeCurrency cuando una inversión está en
  // otra divisa (igual que al registrar un gasto en Economía: tipo de
  // cambio del día, no histórico).
  const accountTotal = useMemo(
    () => (data.transactions ?? []).reduce((sum, tx) => sum + tx.amount, 0),
    [data.transactions],
  )
  const sameCurrency = active.filter((i) => i.currency.toUpperCase() === homeCurrency.toUpperCase())
  const otherCurrency = active.filter((i) => i.currency.toUpperCase() !== homeCurrency.toUpperCase())
  const sameCurrencyTotal = sameCurrency.reduce((sum, i) => sum + i.currentValue, 0)
  const [otherConverted, setOtherConverted] = useState<Record<string, number> | null>(null)
  const [fxError, setFxError] = useState<string | null>(null)
  const otherKey = otherCurrency.map((i) => `${i.id}:${i.currentValue}:${i.currency}`).join("|")

  useEffect(() => {
    if (otherCurrency.length === 0) {
      setOtherConverted({})
      return
    }
    let cancelled = false
    setFxError(null)
    Promise.all(
      otherCurrency.map(async (inv) => {
        const value = await convertAmount(inv.currentValue, inv.currency, homeCurrency, supabase)
        return [inv.id, value] as const
      }),
    )
      .then((pairs) => {
        if (!cancelled) setOtherConverted(Object.fromEntries(pairs))
      })
      .catch((err) => {
        console.error("[investments] fx conversion error:", err)
        if (!cancelled) setFxError(t("settings.saveError"))
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otherKey, homeCurrency])

  const fxPending = otherCurrency.length > 0 && otherConverted === null
  const otherCurrencyTotal = otherConverted ? Object.values(otherConverted).reduce((s, v) => s + v, 0) : 0
  const investedTotal = sameCurrencyTotal + otherCurrencyTotal
  const netWorth = accountTotal + investedTotal

  const [showNewForm, setShowNewForm] = useState(false)

  return (
    <div className="space-y-5">
      <p className="text-xs leading-snug text-muted-foreground">{t("investments.appSummary")}</p>

      <div className="rounded-2xl border border-border bg-muted/30 p-4">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {t("investments.netWorthTitle")}
        </p>
        <p className="mt-0.5 text-2xl font-bold tabular-nums">{fmt(netWorth, homeCurrency)}</p>
        <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
          <span>
            {t("investments.inAccount")}: <span className="font-medium text-foreground">{fmt(accountTotal, homeCurrency)}</span>
          </span>
          <span>
            {t("investments.invested")}: <span className="font-medium text-foreground">{fmt(investedTotal, homeCurrency)}</span>
          </span>
        </div>
        {fxPending && <p className="mt-1.5 text-[11px] text-muted-foreground">{t("common.loading")}</p>}
        {fxError && <p className="mt-1.5 text-[11px] text-red-500">{fxError}</p>}
      </div>

      {!ready ? (
        <p className="text-sm text-muted-foreground">{t("common.loadingData")}</p>
      ) : (
        <>
          {active.length === 0 && (
            <Card className="border-amber-500/50 bg-amber-500/10 p-4">
              <p className="text-sm text-muted-foreground">{t("investments.empty")}</p>
            </Card>
          )}

          <div className="space-y-3">
            {active.map((inv) => (
              <InvestmentCard
                key={inv.id}
                investment={inv}
                contributions={contributions.filter((c) => c.investmentId === inv.id)}
                lang={lang}
                t={t}
                onRename={renameInvestment}
                onUpdateValue={updateInvestmentValue}
                onArchive={archiveInvestment}
                onDelete={deleteInvestment}
                onAddContribution={addContribution}
                onDeleteContribution={deleteContribution}
              />
            ))}
          </div>

          {showNewForm ? (
            <NewInvestmentForm
              homeCurrency={homeCurrency}
              t={t}
              onCancel={() => setShowNewForm(false)}
              onCreate={async (payload) => {
                await addInvestment(payload)
                setShowNewForm(false)
              }}
            />
          ) : (
            <Button onClick={() => setShowNewForm(true)} className="w-full">
              <Plus className="size-4" />
              {t("investments.addButton")}
            </Button>
          )}

          {archived.length > 0 && (
            <div className="space-y-2 border-t border-border pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("investments.archivedSection")}
              </p>
              {archived.map((inv) => (
                <InvestmentCard
                  key={inv.id}
                  investment={inv}
                  contributions={contributions.filter((c) => c.investmentId === inv.id)}
                  lang={lang}
                  t={t}
                  onRename={renameInvestment}
                  onUpdateValue={updateInvestmentValue}
                  onArchive={archiveInvestment}
                  onDelete={deleteInvestment}
                  onAddContribution={addContribution}
                  onDeleteContribution={deleteContribution}
                  dimmed
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function NewInvestmentForm({
  homeCurrency,
  t,
  onCancel,
  onCreate,
}: {
  homeCurrency: string
  t: (key: any, params?: Record<string, string | number>) => string
  onCancel: () => void
  onCreate: (payload: { name: string; type: InvestmentType; currency: string; currentValue: number }) => Promise<void>
}) {
  const [name, setName] = useState("")
  const [type, setType] = useState<InvestmentType>("pias")
  const [currency, setCurrency] = useState(homeCurrency)
  const [value, setValue] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    try {
      await onCreate({
        name: name.trim(),
        type,
        currency,
        currentValue: value.trim() === "" ? 0 : Number(value.replace(",", ".")),
      })
    } catch (err) {
      console.error("[investments] create error:", err)
      setError(t("investments.saveError"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="p-5 animate-in slide-in-from-top-4 duration-300">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{t("investments.newTitle")}</h2>
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
          <X className="size-4" />
        </button>
      </div>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="inv-name">{t("investments.name")}</Label>
          <Input
            id="inv-name"
            autoFocus
            placeholder={t("investments.namePlaceholder")}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>{t("investments.type")}</Label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as InvestmentType)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {INVESTMENT_TYPES.map((ty) => (
              <option key={ty} value={ty}>
                {t(`investments.type.${ty}` as any)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="inv-value">{t("investments.currentValue")}</Label>
          <div className="flex gap-2">
            <Input
              id="inv-value"
              type="number"
              inputMode="decimal"
              min="0"
              placeholder="0.00"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="flex-1"
            />
            <select
              aria-label={t("common.currency")}
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="flex h-9 w-28 shrink-0 rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code}
                </option>
              ))}
            </select>
          </div>
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <Button onClick={handleSave} disabled={saving || !name.trim()} className="w-full">
          {saving ? t("common.saving") : t("common.save")}
        </Button>
      </div>
    </Card>
  )
}

function InvestmentCard({
  investment,
  contributions,
  lang,
  t,
  onRename,
  onUpdateValue,
  onArchive,
  onDelete,
  onAddContribution,
  onDeleteContribution,
  dimmed,
}: {
  investment: Investment
  contributions: ReturnType<typeof useInvestments>["contributions"]
  lang: Language
  t: (key: any, params?: Record<string, string | number>) => string
  onRename: (id: string, name: string) => Promise<void>
  onUpdateValue: (id: string, value: number) => Promise<void>
  onArchive: (id: string, archived: boolean) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onAddContribution: (investmentId: string, amount: number, date: string, note?: string | null) => Promise<void>
  onDeleteContribution: (id: string) => Promise<void>
  dimmed?: boolean
}) {
  const Icon = TYPE_ICON[investment.type]
  const netContributed = investmentNetContributed(contributions, investment.id)
  const gain = investmentGain(investment, contributions)
  const hasHistory = contributions.length > 0
  const locale = lang === "en" ? "en-US" : "es-ES"

  const [expanded, setExpanded] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(investment.name)
  const [editingValue, setEditingValue] = useState(false)
  const [valueInput, setValueInput] = useState(String(investment.currentValue))
  const [showContribForm, setShowContribForm] = useState(false)
  const [contribAmount, setContribAmount] = useState("")
  const [contribDate, setContribDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [contribNote, setContribNote] = useState("")
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const saveName = async () => {
    const trimmed = nameInput.trim()
    if (!trimmed || trimmed === investment.name) {
      setEditingName(false)
      setNameInput(investment.name)
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onRename(investment.id, trimmed)
      setEditingName(false)
    } catch (err) {
      console.error("[investments] rename error:", err)
      setError(t("investments.saveError"))
    } finally {
      setBusy(false)
    }
  }

  const saveValue = async () => {
    const trimmed = valueInput.trim()
    const n = Number(trimmed.replace(",", "."))
    if (trimmed === "" || Number.isNaN(n)) {
      setEditingValue(false)
      setValueInput(String(investment.currentValue))
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onUpdateValue(investment.id, n)
      setEditingValue(false)
    } catch (err) {
      console.error("[investments] update value error:", err)
      setError(t("investments.saveError"))
    } finally {
      setBusy(false)
    }
  }

  const saveContribution = async () => {
    const n = Number(contribAmount.replace(",", "."))
    if (Number.isNaN(n) || n === 0) return
    setBusy(true)
    setError(null)
    try {
      await onAddContribution(investment.id, n, contribDate, contribNote.trim() || null)
      setContribAmount("")
      setContribNote("")
      setShowContribForm(false)
    } catch (err) {
      console.error("[investments] add contribution error:", err)
      setError(t("investments.saveError"))
    } finally {
      setBusy(false)
    }
  }

  const toggleArchive = async () => {
    setBusy(true)
    setError(null)
    try {
      await onArchive(investment.id, !investment.archived)
    } catch (err) {
      console.error("[investments] archive error:", err)
      setError(t("investments.saveError"))
    } finally {
      setBusy(false)
    }
  }

  const confirmDelete = async () => {
    setBusy(true)
    setError(null)
    try {
      await onDelete(investment.id)
    } catch (err) {
      console.error("[investments] delete error:", err)
      setError(t("investments.saveError"))
      setBusy(false)
    }
  }

  return (
    <Card className={`p-4 ${dimmed ? "opacity-60" : ""}`}>
      <div className="flex items-start gap-3">
        <div
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
        >
          <Icon className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          {editingName ? (
            <div className="flex items-center gap-1.5">
              <Input
                autoFocus
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveName()}
                className="h-7 text-sm"
              />
              <Button size="sm" className="h-7 text-xs" disabled={busy} onClick={saveName}>
                {t("common.save")}
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setEditingName(true)}
              className="flex items-center gap-1 text-left text-sm font-semibold hover:underline"
            >
              {investment.name}
              <Pencil className="size-3 text-muted-foreground" />
            </button>
          )}
          <p className="text-[11px] text-muted-foreground">
            {t(`investments.type.${investment.type}` as any)}
            {investment.archived && ` · ${t("investments.archivedSection")}`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="shrink-0 text-muted-foreground hover:text-foreground"
          aria-label={t("investments.contributions")}
        >
          <ChevronDown className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          {editingValue ? (
            <div className="flex items-center gap-1.5">
              <Input
                autoFocus
                type="number"
                inputMode="decimal"
                value={valueInput}
                onChange={(e) => setValueInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveValue()}
                className="h-7 w-28 text-sm"
              />
              <Button size="sm" className="h-7 text-xs" disabled={busy} onClick={saveValue}>
                {t("common.save")}
              </Button>
            </div>
          ) : (
            <button type="button" onClick={() => setEditingValue(true)} className="text-left">
              <p className="text-xl font-bold tabular-nums">{fmt(investment.currentValue, investment.currency)}</p>
              <p className="text-[11px] text-muted-foreground">
                {investment.currentValueUpdatedAt
                  ? t("investments.lastUpdated", {
                      date: new Date(investment.currentValueUpdatedAt).toLocaleDateString(locale, {
                        day: "numeric",
                        month: "short",
                      }),
                    })
                  : t("investments.noValueYet")}
              </p>
            </button>
          )}
        </div>

        {hasHistory && (
          <div className="text-right">
            <p
              className={`flex items-center justify-end gap-1 text-sm font-semibold tabular-nums ${
                gain >= 0 ? "text-emerald-500" : "text-red-500"
              }`}
            >
              {gain >= 0 ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
              {fmt(gain, investment.currency)}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {t("investments.contributed")}: {fmt(netContributed, investment.currency)}
            </p>
          </div>
        )}
      </div>

      {error && <p className="mt-2 text-[11px] text-red-500">{error}</p>}

      {expanded && (
        <div className="mt-4 space-y-2 border-t border-border pt-3">
          {contributions.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("investments.noContributions")}</p>
          ) : (
            <div className="space-y-1.5">
              {contributions.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-2 text-xs">
                  <div className="min-w-0">
                    <span className={c.amount >= 0 ? "text-emerald-500" : "text-red-500"}>
                      {fmt(c.amount, investment.currency)}
                    </span>
                    <span className="ml-2 text-muted-foreground">
                      {new Date(c.date + "T00:00:00").toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                    {c.note && <span className="ml-2 truncate text-muted-foreground">{c.note}</span>}
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeleteContribution(c.id)}
                    className="shrink-0 text-muted-foreground hover:text-red-500"
                    aria-label={t("common.delete")}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {showContribForm ? (
            <div className="space-y-2 rounded-md border border-border p-2.5">
              <Input
                autoFocus
                type="number"
                inputMode="decimal"
                placeholder={t("investments.contributionAmount")}
                value={contribAmount}
                onChange={(e) => setContribAmount(e.target.value)}
                className="h-8 text-sm"
              />
              <Input
                type="date"
                value={contribDate}
                onChange={(e) => setContribDate(e.target.value)}
                className="h-8 text-sm"
              />
              <Input
                placeholder={t("investments.contributionNote")}
                value={contribNote}
                onChange={(e) => setContribNote(e.target.value)}
                className="h-8 text-sm"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="h-7 flex-1 text-xs"
                  disabled={busy || !contribAmount}
                  onClick={saveContribution}
                >
                  {t("common.save")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => setShowContribForm(false)}
                >
                  {t("common.cancel")}
                </Button>
              </div>
            </div>
          ) : (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowContribForm(true)}>
              <Plus className="size-3" />
              {t("investments.addContribution")}
            </Button>
          )}

          <div className="flex items-center justify-between border-t border-border pt-2.5">
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={toggleArchive} disabled={busy}>
              {investment.archived ? t("investments.unarchive") : t("investments.archive")}
            </Button>

            {confirmingDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground">{t("investments.deleteConfirmBody")}</span>
                <Button size="sm" variant="destructive" className="h-7 text-xs" disabled={busy} onClick={confirmDelete}>
                  {t("common.delete")}
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setConfirmingDelete(false)}>
                  {t("common.cancel")}
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-red-500 hover:bg-red-500/10 hover:text-red-500"
                onClick={() => setConfirmingDelete(true)}
              >
                <Trash2 className="size-3.5" />
                {t("common.delete")}
              </Button>
            )}
          </div>
        </div>
      )}
    </Card>
  )
}
