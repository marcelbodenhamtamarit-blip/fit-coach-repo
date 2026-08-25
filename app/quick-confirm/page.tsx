"use client"

// Pantalla que abre la automatización de "pagar con tarjeta" en vez de las
// tres preguntas nativas de Atajos (Preguntar + 2x Elegir de un menú), que
// últimamente tardan mucho en aparecer encadenadas y además se ven a lo
// Apple genérico. Ahora el atajo solo tiene que hacer un "Abrir URLs" a
// /quick-confirm?token=TU_CODIGO — una sola apertura, una sola pantalla,
// con la marca de ZentOS.
//
// No usa lib/store.tsx ni useAuth a propósito: no hace falta tener sesión
// iniciada en el Safari que abre el atajo (normalmente no la tiene). La
// identidad viene del token personal (el mismo que ya se genera en
// Ajustes > Atajo rápido), que el backend resuelve en /api/quick-transaction
// exactamente igual que antes.
//
// Admite además unos parámetros opcionales (amount/type/category) por si
// en el futuro el atajo llega a mandar algo ya adivinado desde la
// notificación del pago — hoy no los manda nadie, así que por defecto la
// pantalla sale en blanco lista para rellenar a mano en 2 toques.

import { Suspense, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Check, Loader2 } from "lucide-react"
import { TRANSACTION_CATEGORIES } from "@/lib/types"

type TxType = "gasto" | "ingreso"

const CATEGORY_EMOJI: Record<string, string> = {
  Alojamiento: "\u{1F3E0}",
  Supermercado: "\u{1F6D2}",
  "Comida fuera": "\u{1F37D}️",
  Transporte: "\u{1F697}",
  Salario: "\u{1F4B0}",
  Compras: "\u{1F6CD}️",
  Necesidades: "\u{1F9FE}",
  Ocio: "\u{1F3AC}",
  Otros: "\u{1F4CC}",
}

function isKnownCategory(value: string | null): value is (typeof TRANSACTION_CATEGORIES)[number] {
  return !!value && (TRANSACTION_CATEGORIES as readonly string[]).includes(value)
}

function QuickConfirmInner() {
  const params = useSearchParams()
  const token = params.get("token") ?? ""
  const prefillAmount = params.get("amount")
  const prefillType = params.get("type") === "ingreso" ? "ingreso" : "gasto"
  const prefillCategory = params.get("category")

  const [amount, setAmount] = useState(prefillAmount ?? "")
  const [type, setType] = useState<TxType>(prefillType as TxType)
  const [category, setCategory] = useState<string>(isKnownCategory(prefillCategory) ? prefillCategory : "Otros")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")

  async function handleSave() {
    const raw = parseFloat(amount.replace(",", "."))
    if (isNaN(raw) || raw === 0) {
      setError("Escribe una cantidad válida")
      return
    }
    if (!token) {
      setError("Falta el código en el enlace. Ábrelo desde el atajo o cópialo de nuevo desde Ajustes.")
      return
    }

    setSaving(true)
    setError("")

    try {
      const res = await fetch("/api/quick-transaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, amount: raw, type, category }),
      })
      const json = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(
          res.status === 401
            ? "Ese código ya no es válido. Genera uno nuevo en Ajustes → Atajo rápido."
            : json.error || "No se pudo guardar. Inténtalo otra vez.",
        )
        setSaving(false)
        return
      }

      setSaving(false)
      setSaved(true)
      setAmount("")
      setCategory("Otros")
      setType("gasto")
      setTimeout(() => setSaved(false), 1800)
    } catch {
      setSaving(false)
      setError("Sin conexión. Inténtalo otra vez.")
    }
  }

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-6 overflow-hidden px-5 py-10"
      style={{
        background:
          "linear-gradient(to bottom, oklch(0.62 0.16 145) 0%, oklch(0.48 0.13 150) 18%, oklch(0.30 0.07 175) 42%, oklch(0.17 0.015 250) 70%, oklch(0.17 0.015 250) 100%)",
      }}
    >
      <div className="w-full max-w-sm animate-in fade-in zoom-in-95 duration-300 ease-out">
        <div className="rounded-3xl border border-white/10 bg-[#141416]/90 p-6 shadow-2xl backdrop-blur-md">
          <div className="mb-5 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/40">ZentOS</p>
            <h1 className="mt-1 text-base font-semibold text-white">Nuevo movimiento</h1>
          </div>

          {saved ? (
            <div className="flex flex-col items-center gap-3 py-10 animate-in fade-in zoom-in-95 duration-300">
              <div className="flex size-14 items-center justify-center rounded-full bg-emerald-500/15">
                <Check className="size-7 text-emerald-400" />
              </div>
              <p className="text-sm font-medium text-white">Guardado</p>
            </div>
          ) : (
            <>
              <div className="mb-5 flex gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
                <button
                  type="button"
                  onClick={() => setType("gasto")}
                  className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
                    type === "gasto" ? "bg-red-500/20 text-red-300" : "text-white/50"
                  }`}
                >
                  Gasto (−)
                </button>
                <button
                  type="button"
                  onClick={() => setType("ingreso")}
                  className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
                    type === "ingreso" ? "bg-emerald-500/20 text-emerald-300" : "text-white/50"
                  }`}
                >
                  Ingreso (+)
                </button>
              </div>

              <input
                autoFocus
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                className="mb-5 w-full border-none bg-transparent text-center text-5xl font-bold text-white outline-none placeholder:text-white/20"
              />

              <div className="mb-5 grid grid-cols-3 gap-2">
                {TRANSACTION_CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(c)}
                    className={`flex flex-col items-center gap-1 rounded-xl border p-2.5 text-[11px] transition-colors ${
                      category === c
                        ? "border-emerald-400/60 bg-emerald-500/10 text-white"
                        : "border-white/10 text-white/50 hover:text-white/80"
                    }`}
                  >
                    <span className="text-lg">{CATEGORY_EMOJI[c] ?? "\u{1F4CC}"}</span>
                    {c}
                  </button>
                ))}
              </div>

              {error && <p className="mb-3 text-center text-xs text-red-400">{error}</p>}

              <button
                onClick={handleSave}
                disabled={saving || !amount}
                className="flex h-14 w-full items-center justify-center rounded-2xl text-base font-semibold text-white transition-opacity disabled:opacity-40"
                style={{ backgroundColor: "#7c6fff" }}
              >
                {saving ? <Loader2 className="size-5 animate-spin" /> : "Guardar"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function QuickConfirmPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#101012] text-sm text-white/40">
          Cargando...
        </div>
      }
    >
      <QuickConfirmInner />
    </Suspense>
  )
}
