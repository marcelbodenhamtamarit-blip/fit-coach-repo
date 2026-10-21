// Gate para la "nueva versión" de ZentOS (rediseño del dock con el Árbol de
// Gastos + el apartado de IA Timmy): solo las cuentas de esta lista ven el
// nuevo dock y las nuevas pantallas. El resto de usuarios (ahora que la app
// está abierta a registros nuevos, ver NEXT_PUBLIC_OWNER_EMAIL vacío en
// Vercel) sigue viendo la app exactamente igual que antes.
//
// Mismo patrón que el antiguo AUTOMATIONS_BETA_EMAILS (lib/beta.ts), que se
// eliminó el 28 Sep 2026 al abrir Automatizaciones a todo el mundo — aquí se
// vuelve a usar porque este rediseño todavía se está probando con una sola
// cuenta antes de decidir si se abre a todos.
export const REDESIGN_BETA_EMAILS = ["marcelbodenham@gmail.com"]

export function isRedesignBetaUser(email: string | null | undefined): boolean {
  const e = (email ?? "").trim().toLowerCase()
  if (!e) return false
  return REDESIGN_BETA_EMAILS.some((allowed) => allowed.toLowerCase() === e)
}
