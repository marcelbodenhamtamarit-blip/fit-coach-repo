"use client"

import { useAuth } from "@/lib/use-auth"

// Mientras se prueba el nuevo diseño de Resumen (fondo verde arriba,
// tarjetas claras, resumen de balance), solo se activa para esta cuenta —
// así se puede ver funcionando en la app real sin cambiarle la vista a
// nadie más. Cuando guste el resultado, se borra este archivo y los
// "if (preview)" / "preview &&" que lo usan (en dashboard.tsx,
// overview-section.tsx y stat-card.tsx) y queda activado para todo el
// mundo.
const PREVIEW_EMAIL = "marcelbodenham@gmail.com"

export function useDesignPreview(): boolean {
  const { user } = useAuth()
  return user?.email === PREVIEW_EMAIL
}
