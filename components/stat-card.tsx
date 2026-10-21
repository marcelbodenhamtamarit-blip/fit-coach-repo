import type { LucideIcon } from "lucide-react"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type StatCardProps = {
  icon: LucideIcon
  label: string
  value: string
  sub?: string
  accent?: "primary" | "blue" | "amber" | "pink" | "teal" | "lime" | "rose" | "green" | "red"
  // Color real (p.ej. el de la categoría con más gasto, ver
  // lib/timmy-insights.ts CATEGORY_COLOR) para cuando el valor de la
  // tarjeta ya tiene su propio color asociado en el resto de la app — si
  // se pasa, sustituye a "accent" tanto en el icono como en el borde de la
  // tarjeta, en vez del genérico fijo por tipo de dato.
  accentColor?: string
  // Nueva versión (ver lib/redesign-beta.ts): borde de color en vez del
  // borde neutro de siempre, a juego con el Árbol de Gastos/IA Timmy.
  redesign?: boolean
}

const accentMap: Record<NonNullable<StatCardProps["accent"]>, string> = {
  primary: "text-[var(--chart-1)] bg-[var(--chart-1)]/10",
  blue: "text-[var(--chart-2)] bg-[var(--chart-2)]/10",
  amber: "text-[var(--chart-3)] bg-[var(--chart-3)]/10",
  pink: "text-[var(--chart-4)] bg-[var(--chart-4)]/10",
  teal: "text-[var(--chart-5)] bg-[var(--chart-5)]/10",
  lime: "text-lime-500 bg-lime-500/10",
  rose: "text-rose-500 bg-rose-500/10",
  green: "text-emerald-500 bg-emerald-500/10",
  red: "text-red-500 bg-red-500/10",
}

// Aproximación en hex de cada acento (las variables --chart-N son oklch),
// solo para el borde de la tarjeta en la nueva versión — no hace falta que
// sea el valor exacto, solo quedar a juego con el icono de al lado.
const accentHex: Record<NonNullable<StatCardProps["accent"]>, string> = {
  primary: "#a3e635",
  blue: "#60a5fa",
  amber: "#fbbf24",
  pink: "#c084fc",
  teal: "#2dd4bf",
  lime: "#84cc16",
  rose: "#fb7185",
  green: "#34d399",
  red: "#f87171",
}

export function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent = "primary",
  accentColor,
  redesign,
}: StatCardProps) {
  const color = accentColor ?? accentHex[accent]
  return (
    <Card
      className={cn("gap-0 p-4", redesign && "border-2")}
      style={redesign ? { borderColor: color } : undefined}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span
          className={cn(
            "flex size-8 items-center justify-center rounded-lg",
            !accentColor && accentMap[accent],
          )}
          style={accentColor ? { color, backgroundColor: `${color}1a` } : undefined}
        >
          <Icon className="size-4" />
        </span>
      </div>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-2xl font-semibold tabular-nums">{value}</span>
      </div>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </Card>
  )
}
