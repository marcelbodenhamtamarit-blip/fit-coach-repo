"use client"

// Inversiones (PIAS, Revolut, criptomonedas...), aparte de Economía: ver
// lib/investments-store.tsx para el porqué de un provider separado y
// supabase-migrations/investments.sql para el esquema. Entrada 100% manual
// -- no hay precio en vivo de nada -- así que lo único que hace esta
// pantalla es dejar guardar "cuánto vale esto ahora" y, con el historial de
// aportaciones/retiradas, calcular ganancia/pérdida real.
import { useEffect, useMemo, useRef, useState } from "react"
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
  Upload,
  LineChart,
  Gem,
  RefreshCw,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useStore } from "@/lib/store"
import { useInvestments } from "@/lib/investments-store"
import { supabase } from "@/lib/supabase"
import { convertAmount } from "@/lib/exchange-rates"
import { fetchLivePrice, valueFromLivePrice } from "@/lib/market-price"
import {
  CURRENCIES,
  currencySymbol,
  INVESTMENT_TYPES,
  investmentGain,
  investmentNetContributed,
  isLivePriceType,
  PRICE_UNITS,
  type Investment,
  type InvestmentType,
  type PriceUnit,
} from "@/lib/types"
import { type Language } from "@/lib/i18n"

const TYPE_ICON: Record<InvestmentType, typeof Landmark> = {
  pias: Landmark,
  stocks: LineChart,
  gold: Gem,
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
    addContributionsBulk,
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
  // Botón de importar CSV/PDF a nivel de pantalla principal, no solo dentro
  // de una inversión ya creada y expandida (eso seguía existiendo, pero
  // Cel no lo encontraba porque exige tener ya una inversión creada — ver
  // ImportCsvPanel: aquí se puede elegir "nueva inversión" en el mismo
  // paso, sin tener que crearla antes a mano).
  const [csvPanelOpen, setCsvPanelOpen] = useState(false)

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
                onAddContributionsBulk={addContributionsBulk}
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
          ) : csvPanelOpen ? (
            <ImportCsvPanel
              investments={active}
              homeCurrency={homeCurrency}
              t={t}
              onAddInvestment={addInvestment}
              onAddContributionsBulk={addContributionsBulk}
              onUpdateValue={updateInvestmentValue}
              onClose={() => setCsvPanelOpen(false)}
            />
          ) : (
            <div className="flex gap-2">
              <Button onClick={() => setShowNewForm(true)} className="flex-1">
                <Plus className="size-4" />
                {t("investments.addButton")}
              </Button>
              <Button variant="outline" onClick={() => setCsvPanelOpen(true)} className="flex-1">
                <Upload className="size-4" />
                {t("investments.importCsv")}
              </Button>
            </div>
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
                  onAddContributionsBulk={addContributionsBulk}
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
  onCreate: (payload: {
    name: string
    type: InvestmentType
    currency: string
    currentValue: number
    symbol?: string | null
    quantity?: number | null
    priceUnit?: string | null
  }) => Promise<void>
}) {
  const [name, setName] = useState("")
  const [type, setType] = useState<InvestmentType>("pias")
  const [currency, setCurrency] = useState(homeCurrency)
  const [value, setValue] = useState("")
  const [symbol, setSymbol] = useState("")
  const [quantity, setQuantity] = useState("")
  const [priceUnit, setPriceUnit] = useState<PriceUnit>("gram")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const live = isLivePriceType(type)

  const handleSave = async () => {
    if (!name.trim()) return
    if (live && (!quantity.trim() || Number.isNaN(Number(quantity.replace(",", "."))))) return
    if (type === "stocks" && !symbol.trim()) return
    setSaving(true)
    setError(null)
    try {
      await onCreate({
        name: name.trim(),
        type,
        currency: live ? "USD" : currency,
        currentValue: live ? 0 : value.trim() === "" ? 0 : Number(value.replace(",", ".")),
        symbol: type === "stocks" ? symbol.trim().toUpperCase() : type === "gold" ? "XAU" : null,
        quantity: live ? Number(quantity.replace(",", ".")) : null,
        priceUnit: type === "stocks" ? "share" : type === "gold" ? priceUnit : null,
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
        {live ? (
          <>
            {type === "stocks" && (
              <div className="space-y-1.5">
                <Label htmlFor="inv-symbol">{t("investments.symbol")}</Label>
                <Input
                  id="inv-symbol"
                  placeholder={t("investments.symbolPlaceholder")}
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="inv-quantity">
                {type === "stocks" ? t("investments.quantityShares") : t("investments.quantity")}
              </Label>
              <div className="flex gap-2">
                <Input
                  id="inv-quantity"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  placeholder="0"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="flex-1"
                />
                {type === "gold" && (
                  <select
                    aria-label={t("investments.priceUnit")}
                    value={priceUnit}
                    onChange={(e) => setPriceUnit(e.target.value as PriceUnit)}
                    className="flex h-9 w-28 shrink-0 rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {PRICE_UNITS.filter((u) => u !== "share").map((u) => (
                      <option key={u} value={u}>
                        {t(`investments.priceUnit.${u}` as any)}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
            <p className="text-[11px] leading-snug text-muted-foreground">{t("investments.livePriceHint")}</p>
          </>
        ) : (
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
        )}
        {error && <p className="text-xs text-red-500">{error}</p>}
        <Button
          onClick={handleSave}
          disabled={saving || !name.trim() || (live && !quantity.trim()) || (type === "stocks" && !symbol.trim())}
          className="w-full"
        >
          {saving ? t("common.saving") : t("common.save")}
        </Button>
      </div>
    </Card>
  )
}

// Importar CSV/PDF desde la pantalla principal de Inversiones, sin exigir
// tener ya una inversión creada de antemano (a diferencia del import que
// sigue viviendo dentro de cada InvestmentCard expandida, pensado para
// añadir MÁS historial a una inversión que ya existe). Aquí se elige a qué
// inversión van las aportaciones importadas — una ya existente, o una
// nueva que se crea en el mismo gesto — antes de confirmar.
function ImportCsvPanel({
  investments,
  homeCurrency,
  t,
  onAddInvestment,
  onAddContributionsBulk,
  onUpdateValue,
  onClose,
}: {
  investments: Investment[]
  homeCurrency: string
  t: (key: any, params?: Record<string, string | number>) => string
  onAddInvestment: (payload: {
    name: string
    type: InvestmentType
    currency: string
    currentValue: number
  }) => Promise<Investment>
  onAddContributionsBulk: (
    investmentId: string,
    rows: { amount: number; date: string; note?: string | null }[],
  ) => Promise<void>
  onUpdateValue: (id: string, value: number) => Promise<void>
  onClose: () => void
}) {
  type CsvRow = { date: string; amount: number; note: string }
  const NEW_TARGET = "__new__"

  const [csvFileName, setCsvFileName] = useState<string | null>(null)
  const [csvRows, setCsvRows] = useState<CsvRow[] | null>(null)
  const [csvIncluded, setCsvIncluded] = useState<Set<number>>(new Set())
  const [csvDetectedBalance, setCsvDetectedBalance] = useState<number | null>(null)
  const [csvUpdateValue, setCsvUpdateValue] = useState(false)
  const [csvBalanceInput, setCsvBalanceInput] = useState("")
  const [csvBusy, setCsvBusy] = useState(false)
  const [csvError, setCsvError] = useState<string | null>(null)
  const [csvSuccessCount, setCsvSuccessCount] = useState<number | null>(null)
  const csvInputRef = useRef<HTMLInputElement | null>(null)

  const [targetId, setTargetId] = useState<string>(investments.length > 0 ? investments[0].id : NEW_TARGET)
  const [newName, setNewName] = useState("")
  const [newType, setNewType] = useState<InvestmentType>("revolut")

  const isNewTarget = investments.length === 0 || targetId === NEW_TARGET
  const targetCurrency = isNewTarget
    ? homeCurrency
    : (investments.find((i) => i.id === targetId)?.currency ?? homeCurrency)

  // Mismo patrón que en NewInvestmentForm / InvestmentCard: las inversiones
  // de precio en vivo (acciones/oro) sacan su valor de cantidad × precio de
  // mercado, no de un saldo de extracto — no tiene sentido ofrecerlas como
  // destino para "crear nueva inversión" desde un CSV importado.
  const manualTypes = INVESTMENT_TYPES.filter((ty) => !isLivePriceType(ty))

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = typeof reader.result === "string" ? reader.result : ""
        resolve(result.slice(result.indexOf(",") + 1))
      }
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    })

  const handleCsvFile = async (file: File) => {
    setCsvError(null)
    setCsvSuccessCount(null)
    setCsvFileName(file.name)
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
    if (isPdf && file.size > 15_000_000) {
      setCsvError(t("investments.importCsvParseError"))
      return
    }
    setCsvBusy(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token
      if (!accessToken) {
        setCsvError(t("investments.saveError"))
        return
      }
      const payload = isPdf ? { pdfBase64: await fileToBase64(file) } : { csv: await file.text() }
      const res = await fetch("/api/import-investments", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(payload),
      })
      const result = await res.json()
      if (!res.ok || !Array.isArray(result.contributions)) {
        setCsvError(result.error || t("investments.importCsvParseError"))
        return
      }
      const rows: CsvRow[] = result.contributions
      if (rows.length === 0) {
        setCsvRows([])
        setCsvError(t("investments.importCsvNoRows"))
        return
      }
      setCsvRows(rows)
      setCsvIncluded(new Set(rows.map((_, i) => i)))
      if (typeof result.currentBalance === "number") {
        setCsvDetectedBalance(result.currentBalance)
        setCsvUpdateValue(true)
        setCsvBalanceInput(String(result.currentBalance))
      }
    } catch (err) {
      console.error("[investments] csv import error:", err)
      setCsvError(t("investments.importCsvParseError"))
    } finally {
      setCsvBusy(false)
    }
  }

  const toggleCsvRow = (index: number) => {
    setCsvIncluded((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const csvSelectedRows = (csvRows ?? []).filter((_, i) => csvIncluded.has(i))
  const csvSelectedSum = csvSelectedRows.reduce((sum, r) => sum + r.amount, 0)

  const confirmCsvImport = async () => {
    if (csvSelectedRows.length === 0) return
    if (isNewTarget && !newName.trim()) return
    setCsvBusy(true)
    setCsvError(null)
    try {
      let investmentId = targetId
      if (isNewTarget) {
        const created = await onAddInvestment({
          name: newName.trim(),
          type: newType,
          currency: homeCurrency,
          currentValue: 0,
        })
        investmentId = created.id
      }
      await onAddContributionsBulk(
        investmentId,
        csvSelectedRows.map((r) => ({ amount: r.amount, date: r.date, note: r.note || null })),
      )
      if (csvUpdateValue) {
        const n = Number(csvBalanceInput.replace(",", "."))
        if (!Number.isNaN(n)) await onUpdateValue(investmentId, n)
      }
      setCsvSuccessCount(csvSelectedRows.length)
      setCsvRows(null)
      setCsvFileName(null)
      setCsvDetectedBalance(null)
      setCsvUpdateValue(false)
      setCsvBalanceInput("")
      setNewName("")
    } catch (err) {
      console.error("[investments] csv import error:", err)
      setCsvError(t("investments.saveError"))
    } finally {
      setCsvBusy(false)
    }
  }

  return (
    <Card className="p-5 animate-in slide-in-from-top-4 duration-300">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{t("investments.importCsv")}</h2>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="size-4" />
        </button>
      </div>
      <div className="space-y-4">
        <p className="text-[11px] leading-snug text-muted-foreground">{t("investments.importCsvHint")}</p>

        <input
          ref={csvInputRef}
          type="file"
          accept=".csv,text/csv,.pdf,application/pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleCsvFile(file)
            e.target.value = ""
          }}
        />
        <Button
          variant="outline"
          className="w-full"
          disabled={csvBusy}
          onClick={() => csvInputRef.current?.click()}
        >
          <Upload className="size-4" />
          {csvBusy && !csvRows ? t("common.loading") : (csvFileName ?? t("investments.importCsv"))}
        </Button>

        {csvError && <p className="text-xs text-red-500">{csvError}</p>}

        {csvSuccessCount !== null && (
          <p className="text-xs text-emerald-500">{t("investments.importCsvSuccess", { count: csvSuccessCount })}</p>
        )}

        {csvRows && csvRows.length > 0 && (
          <>
            {investments.length > 0 && (
              <div className="space-y-1.5">
                <Label>{t("investments.importCsvTarget")}</Label>
                <select
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {investments.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.name}
                    </option>
                  ))}
                  <option value={NEW_TARGET}>{t("investments.importCsvTargetNew")}</option>
                </select>
              </div>
            )}

            {isNewTarget && (
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder={t("investments.importCsvNewNamePlaceholder")}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as InvestmentType)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {manualTypes.map((ty) => (
                    <option key={ty} value={ty}>
                      {t(`investments.type.${ty}` as any)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="max-h-52 space-y-1 overflow-y-auto rounded border border-border/60 p-1.5">
              {csvRows.map((r, i) => {
                const checked = csvIncluded.has(i)
                return (
                  <label key={i} className="flex items-center gap-2 rounded px-1 py-1 text-[11px] hover:bg-muted/50">
                    <input type="checkbox" checked={checked} onChange={() => toggleCsvRow(i)} className="shrink-0" />
                    <span className="w-16 shrink-0 tabular-nums text-muted-foreground">{r.date}</span>
                    <span className="min-w-0 flex-1 truncate">{r.note || "—"}</span>
                    <span className={`shrink-0 tabular-nums ${r.amount >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                      {fmt(r.amount, targetCurrency)}
                    </span>
                  </label>
                )
              })}
            </div>

            <p className="text-[11px] text-muted-foreground">
              {t("investments.importCsvRowsSelected", {
                count: csvSelectedRows.length,
                total: csvRows.length,
                sum: fmt(csvSelectedSum, targetCurrency),
              })}
            </p>

            {csvDetectedBalance !== null && (
              <label className="flex items-center gap-2 text-[11px]">
                <input
                  type="checkbox"
                  checked={csvUpdateValue}
                  onChange={(e) => setCsvUpdateValue(e.target.checked)}
                />
                <span className="flex-1">{t("investments.importCsvUpdateValueLabel")}</span>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={csvBalanceInput}
                  onChange={(e) => setCsvBalanceInput(e.target.value)}
                  disabled={!csvUpdateValue}
                  className="h-7 w-24 text-xs"
                />
              </label>
            )}

            <div className="flex gap-2">
              <Button
                className="flex-1"
                disabled={csvBusy || csvSelectedRows.length === 0 || (isNewTarget && !newName.trim())}
                onClick={confirmCsvImport}
              >
                {csvBusy ? t("common.saving") : `${t("investments.importCsvConfirm")} (${csvSelectedRows.length})`}
              </Button>
              <Button variant="ghost" onClick={onClose}>
                {t("investments.importCsvCancel")}
              </Button>
            </div>
          </>
        )}
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
  onAddContributionsBulk,
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
  onAddContributionsBulk: (
    investmentId: string,
    rows: { amount: number; date: string; note?: string | null }[],
  ) => Promise<void>
  onDeleteContribution: (id: string) => Promise<void>
  dimmed?: boolean
}) {
  const Icon = TYPE_ICON[investment.type]
  const netContributed = investmentNetContributed(contributions, investment.id)
  const gain = investmentGain(investment, contributions)
  const hasHistory = contributions.length > 0
  const locale = lang === "en" ? "en-US" : "es-ES"
  const live = isLivePriceType(investment.type)

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

  // Importar CSV o PDF: igual que "Importar CSV o PDF" en Economía (ver
  // app/api/import-investments/route.ts), el archivo se manda a Gemini
  // (ya configurado en el proyecto) para que detecte el formato — puede
  // ser de cualquier bróker/exchange/banco, cada uno maqueta su extracto
  // de forma distinta — y devuelva los movimientos ya normalizados. Se
  // muestra una vista previa con checkboxes antes de guardar nada.
  type CsvRow = { date: string; amount: number; note: string }
  const [csvPanelOpen, setCsvPanelOpen] = useState(false)
  const [csvFileName, setCsvFileName] = useState<string | null>(null)
  const [csvRows, setCsvRows] = useState<CsvRow[] | null>(null)
  const [csvIncluded, setCsvIncluded] = useState<Set<number>>(new Set())
  const [csvDetectedBalance, setCsvDetectedBalance] = useState<number | null>(null)
  const [csvUpdateValue, setCsvUpdateValue] = useState(false)
  const [csvBalanceInput, setCsvBalanceInput] = useState("")
  const [csvBusy, setCsvBusy] = useState(false)
  const [csvError, setCsvError] = useState<string | null>(null)
  const [csvSuccessCount, setCsvSuccessCount] = useState<number | null>(null)
  const csvInputRef = useRef<HTMLInputElement | null>(null)

  // Precio en vivo (stocks/gold): sin esto, el valor es manual como
  // siempre. "Actualizar precio" llama a API Ninjas (cacheado por día en
  // market_prices, ver lib/market-price.ts) y calcula cantidad × precio.
  const [priceBusy, setPriceBusy] = useState(false)
  const [priceError, setPriceError] = useState<string | null>(null)
  const [priceChange, setPriceChange] = useState<number | null>(null)
  const [lastPrice, setLastPrice] = useState<number | null>(null)

  const refreshLivePrice = async () => {
    if (!investment.symbol || !investment.quantity || !investment.priceUnit) return
    setPriceBusy(true)
    setPriceError(null)
    try {
      const result = await fetchLivePrice(investment.symbol, investment.type === "gold" ? "gold" : "stock", supabase)
      const value = valueFromLivePrice(result.price, investment.quantity, investment.priceUnit)
      await onUpdateValue(investment.id, value)
      setLastPrice(result.price)
      if (result.previousPrice !== null && result.previousPrice !== 0) {
        setPriceChange(((result.price - result.previousPrice) / result.previousPrice) * 100)
      } else {
        setPriceChange(null)
      }
    } catch (err) {
      console.error("[investments] live price error:", err)
      setPriceError(t("investments.livePriceError"))
    } finally {
      setPriceBusy(false)
    }
  }

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

  const resetCsvState = () => {
    setCsvRows(null)
    setCsvFileName(null)
    setCsvIncluded(new Set())
    setCsvDetectedBalance(null)
    setCsvUpdateValue(false)
    setCsvBalanceInput("")
    setCsvError(null)
  }

  // Igual que fileToBase64 en economy-section.tsx: readAsDataURL es la
  // forma más simple de conseguir base64 en el navegador, y se le quita el
  // prefijo "data:application/pdf;base64," antes de mandarlo al servidor.
  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = typeof reader.result === "string" ? reader.result : ""
        resolve(result.slice(result.indexOf(",") + 1))
      }
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    })

  const handleCsvFile = async (file: File) => {
    setCsvError(null)
    setCsvSuccessCount(null)
    setCsvFileName(file.name)
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
    if (isPdf && file.size > 15_000_000) {
      setCsvError(t("investments.importCsvParseError"))
      return
    }
    setCsvBusy(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token
      if (!accessToken) {
        setCsvError(t("investments.saveError"))
        return
      }
      const payload = isPdf ? { pdfBase64: await fileToBase64(file) } : { csv: await file.text() }
      const res = await fetch("/api/import-investments", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(payload),
      })
      const result = await res.json()
      if (!res.ok || !Array.isArray(result.contributions)) {
        setCsvError(result.error || t("investments.importCsvParseError"))
        return
      }
      const rows: CsvRow[] = result.contributions
      if (rows.length === 0) {
        setCsvRows([])
        setCsvError(t("investments.importCsvNoRows"))
        return
      }
      setCsvRows(rows)
      setCsvIncluded(new Set(rows.map((_, i) => i)))
      if (typeof result.currentBalance === "number") {
        setCsvDetectedBalance(result.currentBalance)
        setCsvUpdateValue(true)
        setCsvBalanceInput(String(result.currentBalance))
      }
    } catch (err) {
      console.error("[investments] csv import error:", err)
      setCsvError(t("investments.importCsvParseError"))
    } finally {
      setCsvBusy(false)
    }
  }

  const toggleCsvRow = (index: number) => {
    setCsvIncluded((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const csvSelectedRows = (csvRows ?? []).filter((_, i) => csvIncluded.has(i))
  const csvSelectedSum = csvSelectedRows.reduce((sum, r) => sum + r.amount, 0)

  const confirmCsvImport = async () => {
    if (csvSelectedRows.length === 0) return
    setCsvBusy(true)
    setCsvError(null)
    try {
      await onAddContributionsBulk(
        investment.id,
        csvSelectedRows.map((r) => ({ amount: r.amount, date: r.date, note: r.note || null })),
      )
      if (csvUpdateValue) {
        const n = Number(csvBalanceInput.replace(",", "."))
        if (!Number.isNaN(n)) await onUpdateValue(investment.id, n)
      }
      setCsvSuccessCount(csvSelectedRows.length)
      resetCsvState()
      setCsvPanelOpen(false)
    } catch (err) {
      console.error("[investments] csv import error:", err)
      setCsvError(t("investments.saveError"))
    } finally {
      setCsvBusy(false)
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
          {live ? (
            <div>
              <p className="text-xl font-bold tabular-nums">{fmt(investment.currentValue, investment.currency)}</p>
              <p className="text-[11px] text-muted-foreground">
                {lastPrice !== null
                  ? t("investments.priceAt", {
                      price: fmt(lastPrice, investment.currency),
                      unit: t(`investments.priceUnitLabel.${investment.priceUnit}` as any),
                      date: new Date().toLocaleDateString(locale, { day: "numeric", month: "short" }),
                    })
                  : investment.currentValueUpdatedAt
                    ? t("investments.lastUpdated", {
                        date: new Date(investment.currentValueUpdatedAt).toLocaleDateString(locale, {
                          day: "numeric",
                          month: "short",
                        }),
                      })
                    : t("investments.priceNeverFetched")}
                {priceChange !== null && (
                  <span className={priceChange >= 0 ? "ml-1.5 text-emerald-500" : "ml-1.5 text-red-500"}>
                    {priceChange >= 0 ? "▲" : "▼"} {Math.abs(priceChange).toFixed(1)}%
                  </span>
                )}
              </p>
              <button
                type="button"
                onClick={refreshLivePrice}
                disabled={priceBusy}
                className="mt-1 flex items-center gap-1 text-[11px] font-medium text-primary hover:underline disabled:opacity-50"
              >
                <RefreshCw className={`size-3 ${priceBusy ? "animate-spin" : ""}`} />
                {t("investments.updatePrice")}
              </button>
              {priceError && <p className="mt-1 text-[11px] text-red-500">{priceError}</p>}
            </div>
          ) : editingValue ? (
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
            !csvPanelOpen && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowContribForm(true)}>
                  <Plus className="size-3" />
                  {t("investments.addContribution")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => {
                    resetCsvState()
                    setCsvPanelOpen(true)
                  }}
                >
                  <Upload className="size-3" />
                  {t("investments.importCsv")}
                </Button>
              </div>
            )
          )}

          {csvSuccessCount !== null && !csvPanelOpen && (
            <p className="text-[11px] text-emerald-500">
              {t("investments.importCsvSuccess", { count: csvSuccessCount })}
            </p>
          )}

          {csvPanelOpen && (
            <div className="space-y-2.5 rounded-md border border-border p-2.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium">{t("investments.importCsv")}</p>
                <button
                  type="button"
                  onClick={() => {
                    setCsvPanelOpen(false)
                    resetCsvState()
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              </div>
              <p className="text-[11px] leading-snug text-muted-foreground">{t("investments.importCsvHint")}</p>

              <input
                ref={csvInputRef}
                type="file"
                accept=".csv,text/csv,.pdf,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleCsvFile(file)
                  e.target.value = ""
                }}
              />
              <Button
                size="sm"
                variant="outline"
                className="h-7 w-full text-xs"
                disabled={csvBusy}
                onClick={() => csvInputRef.current?.click()}
              >
                <Upload className="size-3" />
                {csvBusy ? t("common.loading") : csvFileName ?? t("investments.importCsv")}
              </Button>

              {csvError && <p className="text-[11px] text-red-500">{csvError}</p>}

              {csvRows && csvRows.length > 0 && (
                <>
                  <div className="max-h-52 space-y-1 overflow-y-auto rounded border border-border/60 p-1.5">
                    {csvRows.map((r, i) => {
                      const checked = csvIncluded.has(i)
                      return (
                        <label
                          key={i}
                          className="flex items-center gap-2 rounded px-1 py-1 text-[11px] hover:bg-muted/50"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleCsvRow(i)}
                            className="shrink-0"
                          />
                          <span className="w-16 shrink-0 tabular-nums text-muted-foreground">{r.date}</span>
                          <span className="min-w-0 flex-1 truncate">{r.note || "—"}</span>
                          <span
                            className={`shrink-0 tabular-nums ${r.amount >= 0 ? "text-emerald-500" : "text-red-500"}`}
                          >
                            {fmt(r.amount, investment.currency)}
                          </span>
                        </label>
                      )
                    })}
                  </div>

                  <p className="text-[11px] text-muted-foreground">
                    {t("investments.importCsvRowsSelected", {
                      count: csvSelectedRows.length,
                      total: csvRows.length,
                      sum: fmt(csvSelectedSum, investment.currency),
                    })}
                  </p>

                  {csvDetectedBalance !== null && (
                    <label className="flex items-center gap-2 text-[11px]">
                      <input
                        type="checkbox"
                        checked={csvUpdateValue}
                        onChange={(e) => setCsvUpdateValue(e.target.checked)}
                      />
                      <span className="flex-1">{t("investments.importCsvUpdateValueLabel")}</span>
                      <Input
                        type="number"
                        inputMode="decimal"
                        value={csvBalanceInput}
                        onChange={(e) => setCsvBalanceInput(e.target.value)}
                        disabled={!csvUpdateValue}
                        className="h-6 w-24 text-xs"
                      />
                    </label>
                  )}

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="h-7 flex-1 text-xs"
                      disabled={csvBusy || csvSelectedRows.length === 0}
                      onClick={confirmCsvImport}
                    >
                      {csvBusy
                        ? t("common.saving")
                        : `${t("investments.importCsvConfirm")} (${csvSelectedRows.length})`}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() => {
                        setCsvPanelOpen(false)
                        resetCsvState()
                      }}
                    >
                      {t("investments.importCsvCancel")}
                    </Button>
                  </div>
                </>
              )}
            </div>
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
