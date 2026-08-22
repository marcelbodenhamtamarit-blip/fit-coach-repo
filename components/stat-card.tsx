import type { LucideIcon } from "lucide-react"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type StatCardProps = {
  icon: LucideIcon
  label: string
  value: string
  unit?: string
  sub?: string
  accent?: "primary" | "blue" | "amber" | "pink" | "teal" | "lime" | "rose" | "green" | "red"
  // "light": variante clara (fondo casi blanco, texto oscuro) para cuando
  // la tarjeta va sobre un fondo con degradado — ver lib/design-preview.ts.
  variant?: "default" | "light"
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

export function StatCard({
  icon: Icon,
  label,
  value,
  unit,
  sub,
  accent = "primary",
  variant = "default",
}: StatCardProps) {
  const isLight = variant === "light"
  return (
    <Card
      className={cn(
        "gap-0 p-4",
        isLight && "bg-[oklch(0.97_0.006_250)] text-[oklch(0.2_0.01_250)] ring-0 shadow-sm",
      )}
    >
      <div className="flex items-center justify-between">
        <span className={cn("text-xs font-medium", isLight ? "text-[oklch(0.45_0.01_250)]" : "text-muted-foreground")}>
          {label}
        </span>
        <span
          className={cn(
            "flex size-8 items-center justify-center rounded-lg",
            accentMap[accent],
          )}
        >
          <Icon className="size-4" />
        </span>
      </div>
      <div className="mt-3 flex items-baseline gap-1">
        <span className={cn("text-2xl font-semibold tabular-nums", isLight && "text-[oklch(0.2_0.01_250)]")}>{value}</span>
        {unit && (
          <span className={cn("text-sm", isLight ? "text-[oklch(0.45_0.01_250)]" : "text-muted-foreground")}>{unit}</span>
        )}
      </div>
      {sub && <p className={cn("mt-1 text-xs", isLight ? "text-[oklch(0.5_0.01_250)]" : "text-muted-foreground")}>{sub}</p>}
    </Card>
  )
}
