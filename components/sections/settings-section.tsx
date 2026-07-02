"use client"

import { Card } from "@/components/ui/card"

export function SettingsSection() {
  return (
    <div className="max-w-2xl space-y-6">
      <Card className="p-6">
        <h3 className="mb-2 text-sm font-semibold">Sobre esta app</h3>
        <p className="text-xs text-muted-foreground">
          Fit Coach v3.0 • Resumen, Diario (Garmin) y Economía
        </p>
      </Card>
    </div>
  )
}
