"use client"

// Página de "atajo manual": pensada para guardarla como icono en la
// pantalla de inicio del móvil (Safari -> Compartir -> Añadir a pantalla
// de inicio, apuntando a /quick-add). Reemplaza al Shortcut de iOS que
// fallaba: aquí no hace falta leer notificaciones ni parsear texto, solo
// abres el icono, escribes la cantidad y tocas Guardar.
//
// No depende de lib/store.tsx a propósito: así no carga todo el
// dashboard, solo lo mínimo para insertar una fila rápido. Al estar
// logueado, RLS + el default de la columna user_id en Supabase se
// encargan de que la transacción quede asociada a tu cuenta sin tener
// que hacer nada extra aquí.

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Check, Loader2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/lib/use-auth"
import { todayISO, TRANSACTION_CATEGORIES } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

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

export default function QuickAddPage() {
  const { mode } = useAuth()
  const router = useRouter()

  const [amount, setAmount] = useState("")
  const [type, setType] = useState<TxType>("gasto")
  const [category, setCategory] = useState<string>("Otros")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (mode === "out") router.replace("/")
  }, [mode, router])

  async function handleSave() {
    const raw = parseFloat(amount.replace(",", "."))
    if (isNaN(raw) || raw === 0) return

    setSaving(true)
    setError("")

    const value = type === "gasto" ? -Math.abs(raw) : Math.abs(raw)
    const { error } = await supabase.from("transactions").insert({
      date: todayISO(),
      description: category,
      category,
      amount: value,
    })

    setSaving(false)

    if (error) {
      setError(error.message)
      return
    }

    setSaved(true)
    setAmount("")
    setTimeout(() => setSaved(false), 1500)
  }

  if (mode !== "in") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Cargando...
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 py-10">
      <div className="flex gap-1 rounded-lg border border-border bg-muted/40 p-1">
        <button
          type="button"
          onClick={() => setType("gasto")}
          className={`rounded-md px-6 py-2 text-sm font-semibold transition-colors ${
            type === "gasto" ? "bg-red-500/15 text-red-400 shadow-sm" : "text-muted-foreground"
          }`}
        >
          Gasto (−)
        </button>
        <button
          type="button"
          onClick={() => setType("ingreso")}
          className={`rounded-md px-6 py-2 text-sm font-semibold transition-colors ${
            type === "ingreso" ? "bg-emerald-500/15 text-emerald-500 shadow-sm" : "text-muted-foreground"
          }`}
        >
          Ganancia (+)
        </button>
      </div>

      <Input
        autoFocus
        inputMode="decimal"
        placeholder="0.00"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSave()}
        className="h-20 w-full max-w-xs border-none bg-transparent text-center text-5xl font-bold shadow-none focus-visible:ring-0"
      />

      <div className="grid w-full max-w-sm grid-cols-3 gap-2">
        {TRANSACTION_CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-xs transition-colors ${
              category === c
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="text-xl">{CATEGORY_EMOJI[c] ?? "\u{1F4CC}"}</span>
            {c}
          </button>
        ))}
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <Button
        onClick={handleSave}
        disabled={saving || !amount}
        className="h-14 w-full max-w-xs text-base"
        style={{ backgroundColor: "#7c6fff" }}
      >
        {saving ? (
          <Loader2 className="size-5 animate-spin" />
        ) : saved ? (
          <Check className="size-5" />
        ) : (
          "Guardar"
        )}
      </Button>

      <button
        onClick={() => router.push("/")}
        className="text-xs text-muted-foreground underline underline-offset-4"
      >
        Ir a la app completa
      </button>
    </div>
  )
}
