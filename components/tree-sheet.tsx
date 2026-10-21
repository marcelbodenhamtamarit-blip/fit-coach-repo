"use client"

import { useState } from "react"
import { X, Sprout } from "lucide-react"
import type { CategoryBreakdown } from "@/lib/timmy-insights"
import { currencySymbol } from "@/lib/types"

export type PlanLine = { category: string; reduction: number; advice: string }

const TIPS = [
  "Tus gastos cuelgan de las ramas, ordenados de mayor a menor importe.",
  "Toca cualquier rama para ver el desglose de movimientos de ese mes.",
  "El tronco crece con lo que te queda de ingresos menos gastos: tu ahorro real.",
  "Pídele a Timmy un plan de reducción con el botón morado de abajo.",
]

export function TreeSheet({
  open,
  onClose,
  categories,
  income,
  expense,
  homeCurrency,
  planLines,
  planSummary,
  onOpenTimmy,
}: {
  open: boolean
  onClose: () => void
  categories: CategoryBreakdown[]
  income: number
  expense: number
  homeCurrency: string
  planLines: PlanLine[] | null
  planSummary: string | null
  onOpenTimmy: () => void
}) {
  const [tipIndex, setTipIndex] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)

  if (!open) return null

  const symbol = currencySymbol(homeCurrency)
  const selectedCat = categories.find((c) => c.category === selected) ?? null
  const selectedPlan = selectedCat ? planLines?.find((l) => l.category === selectedCat.category) ?? null : null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/75 backdrop-blur-sm lg:left-60"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="animate-in slide-in-from-bottom-4 fade-in duration-300 ease-out flex max-h-[92vh] w-full max-w-[460px] flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#0c1115] shadow-2xl">
        <div className="flex justify-center pt-2">
          <div className="h-1.5 w-9 rounded-full bg-white/20" />
        </div>

        <div className="flex items-start justify-between gap-3 border-b border-white/10 bg-[#0c1115]/90 px-5 pb-3 pt-1">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg">🌳</span>
              <h2 className="text-[15px] font-extrabold text-white">Tu Árbol de Gastos</h2>
            </div>
            <p className="mt-1 text-[11px] text-[#8a97a0]">
              Ramas ordenadas de <strong className="text-[#bef264]">mayor a menor gasto</strong>, este mes
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar árbol"
            className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/80"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-white/[0.03] px-5 py-2 text-[11px]">
          <span className="text-[#8a97a0]">
            Ganado: <strong className="text-[#4ade80]">+{symbol}{income.toFixed(0)}</strong>
            {"  "}Gastos: <strong className="text-white">-{symbol}{expense.toFixed(0)}</strong>
          </span>
          <button type="button" onClick={onOpenTimmy} className="font-bold text-[#a3e635]">
            ⚖️ Plan Timmy{planLines ? ` : -${symbol}${planLines.reduce((s, l) => s + l.reduction, 0)}` : ""}
          </button>
        </div>

        <div className="flex items-center justify-between gap-2 border-b border-[#1f3827] bg-[#121c17] px-5 py-2 text-[11px]">
          <p className="flex-1 truncate text-[#dfe3e6]">🌳 {TIPS[tipIndex]}</p>
          <button
            type="button"
            onClick={() => setTipIndex((i) => (i + 1) % TIPS.length)}
            className="shrink-0 font-extrabold text-[#bef264]"
          >
            Siguiente ❯
          </button>
        </div>

        <div className="min-h-[260px] flex-1 overflow-y-auto bg-[#0c1115] p-4">
          {categories.length === 0 ? (
            <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-2 text-center text-[#8a97a0]">
              <Sprout className="size-8 text-[#4ade80]" />
              <p className="text-sm">Todavía no hay gastos este mes — tu árbol está esperando su primera rama.</p>
            </div>
          ) : (
            <>
              {/* Tronco, ramas y copa, versión estática y compacta (sin la
                  animación de crecimiento del prototipo): el dibujo ya no
                  hace de lienzo interactivo para las categorías, que ahora
                  viven debajo en una rejilla que crece con el número real de
                  categorías sin solaparse ni cortarse — pero sigue siendo un
                  árbol de verdad, con ramas que se bifurcan del tronco y
                  terminan en su propio grupo de hojas, no solo un tronco con
                  una bola encima. */}
              <svg viewBox="0 0 300 190" className="mx-auto h-[150px] w-auto opacity-90" aria-hidden>
                <defs>
                  <linearGradient id="trunkG" x1="0%" y1="100%" x2="0%" y2="0%">
                    <stop offset="0%" stopColor="#2c1a0e" />
                    <stop offset="100%" stopColor="#5c3a21" />
                  </linearGradient>
                  <radialGradient id="canopyG" cx="35%" cy="35%" r="65%">
                    <stop offset="0%" stopColor="#bef264" />
                    <stop offset="55%" stopColor="#4ade80" />
                    <stop offset="100%" stopColor="#14532d" />
                  </radialGradient>
                </defs>
                <ellipse cx="150" cy="178" rx="78" ry="12" fill="#141c19" stroke="#25352e" strokeWidth="2" />

                {/* Tronco principal */}
                <path d="M150 172 C 147 145, 153 120, 150 95 C 148 75, 151 55, 150 38" stroke="url(#trunkG)" strokeWidth="13" strokeLinecap="round" fill="none" />

                {/* Ramas: cada una sale del tronco en un punto distinto y
                    termina en su propio grupo de hojas, para que se note
                    que son ramas y no decoración suelta. */}
                <path d="M150 158 C 128 150, 108 140, 92 124" stroke="url(#trunkG)" strokeWidth="7" strokeLinecap="round" fill="none" />
                <path d="M150 136 C 172 127, 192 118, 206 103" stroke="url(#trunkG)" strokeWidth="7" strokeLinecap="round" fill="none" />
                <path d="M150 108 C 131 98, 116 86, 106 68" stroke="url(#trunkG)" strokeWidth="6" strokeLinecap="round" fill="none" />
                <path d="M150 88 C 167 77, 182 64, 191 48" stroke="url(#trunkG)" strokeWidth="6" strokeLinecap="round" fill="none" />
                <path d="M150 70 C 141 58, 136 48, 136 36" stroke="url(#trunkG)" strokeWidth="5" strokeLinecap="round" fill="none" />
                <path d="M150 64 C 158 52, 163 42, 163 30" stroke="url(#trunkG)" strokeWidth="5" strokeLinecap="round" fill="none" />

                {/* Hojas al final de cada rama */}
                <circle cx="88" cy="118" r="19" fill="url(#canopyG)" opacity="0.92" />
                <circle cx="210" cy="97" r="21" fill="url(#canopyG)" opacity="0.92" />
                <circle cx="102" cy="62" r="17" fill="url(#canopyG)" opacity="0.92" />
                <circle cx="195" cy="43" r="18" fill="url(#canopyG)" opacity="0.92" />
                <circle cx="134" cy="30" r="15" fill="url(#canopyG)" opacity="0.92" />
                <circle cx="165" cy="24" r="16" fill="url(#canopyG)" opacity="0.92" />
                <circle cx="150" cy="30" r="24" fill="url(#canopyG)" />
              </svg>

              <div className="mt-3 grid grid-cols-2 gap-2.5">
                {categories.map((c, i) => (
                  <button
                    key={c.category}
                    type="button"
                    onClick={() => setSelected(c.category)}
                    className="min-w-0 rounded-2xl border-2 p-2.5 text-left shadow-lg transition-transform active:scale-95"
                    style={{ background: "rgba(20,27,31,0.95)", borderColor: c.color }}
                  >
                    <span
                      className="mb-1.5 inline-block rounded-md px-1.5 py-0.5 text-[8px] font-extrabold uppercase"
                      style={{ background: c.color, color: "#06230f" }}
                    >
                      {i === 0 ? "⭐ #1 Mayor" : `#${i + 1} Gasto`}
                    </span>
                    <div className="flex items-center gap-2">
                      <div
                        className="flex size-[30px] shrink-0 items-center justify-center rounded-[10px] text-[15px]"
                        style={{ background: `${c.color}22`, border: `1px solid ${c.color}55` }}
                      >
                        {c.icon}
                      </div>
                      <div className="min-w-0 overflow-hidden">
                        <div className="truncate text-[10.5px] font-semibold text-[#dfe3e6]">{c.category}</div>
                        <div className="text-[13.5px] font-extrabold text-white">{symbol}{c.amount.toFixed(0)}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {selectedCat && (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center bg-black/85 p-4"
            onClick={(e) => e.target === e.currentTarget && setSelected(null)}
          >
            <div className="w-full max-w-[360px] rounded-3xl border border-white/10 bg-[#13191d] p-5 shadow-2xl">
              <div className="mb-4 flex items-center gap-3">
                <div
                  className="flex size-12 items-center justify-center rounded-2xl text-[22px]"
                  style={{ background: `${selectedCat.color}22`, border: `1px solid ${selectedCat.color}` }}
                >
                  {selectedCat.icon}
                </div>
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wide" style={{ color: selectedCat.color }}>
                    Rama de {selectedCat.category}
                  </span>
                  <h3 className="text-[17px] font-extrabold text-white">{selectedCat.category}</h3>
                </div>
              </div>
              <div className="mb-3.5 grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-white/10 bg-[#182126] p-2.5">
                  <span className="block text-[10px] text-[#8d8d96]">Total gastado</span>
                  <span className="text-[19px] font-extrabold text-white">{symbol}{selectedCat.amount.toFixed(0)}</span>
                </div>
                <div className="rounded-xl border border-white/10 bg-[#182126] p-2.5">
                  <span className="block text-[10px] text-[#8d8d96]">Margen reducción</span>
                  <span className="text-[19px] font-extrabold text-[#a3e635]">
                    {selectedPlan ? `-${symbol}${selectedPlan.reduction}` : "—"}
                  </span>
                </div>
              </div>
              <div className="mb-3.5">
                <span className="mb-1.5 block text-[11px] font-semibold text-[#c9c9d1]">Movimientos de este mes:</span>
                <div className="max-h-[160px] space-y-1.5 overflow-y-auto">
                  {selectedCat.transactions.slice(0, 8).map((t) => (
                    <div key={t.id} className="flex items-center justify-between rounded-xl border border-[#27343c] bg-[#1d272d] px-2.5 py-2 text-[12px]">
                      <div>
                        <div className="font-semibold text-white">{t.description}</div>
                        <div className="text-[10px] text-[#8d8d96]">{t.date}</div>
                      </div>
                      <span className="font-bold text-white">{symbol}{Math.abs(t.amount).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mb-3.5 flex items-start gap-2 rounded-xl border border-[#22442c] bg-[#16271c] p-3">
                <span className="text-[#bef264]">💡</span>
                <p className="m-0 text-[11px] leading-relaxed text-[#a7f3d0]">
                  {selectedPlan?.advice ?? "Pídele a Timmy un plan de reducción para ver un consejo aquí."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="w-full rounded-xl bg-[#a3e635] py-2.5 text-[12px] font-extrabold text-[#06230f]"
              >
                Cerrar detalle
              </button>
            </div>
          </div>
        )}

        {planSummary && (
          <div className="border-t border-white/10 bg-white/[0.03] px-5 py-2 text-center text-[10.5px] text-[#9aa5ad]">
            {planSummary}
          </div>
        )}
      </div>
    </div>
  )
}
