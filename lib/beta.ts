// Lista de prueba para funciones nuevas antes de abrirlas a todo el mundo.
// Pensada para algo simple y temporal (no una tabla de Supabase ni un
// sistema de flags de verdad) — se edita a mano aquí y se sube con un
// commit normal cuando toque.
//
// Cómo usarla:
//   - Mientras se está probando: deja aquí solo los emails de quien debe
//     verla (el tuyo, y el de quien más quieras que la pruebe contigo).
//   - Para abrirla a todo el mundo: cambia BETA_EMAILS por "*" (la cadena
//     literal, no un array) — isBetaUser() devuelve true para cualquiera
//     en ese caso. Así no hay que tocar dashboard.tsx ni settings-section.tsx
//     otra vez, con cambiar esta única línea (y hacer commit + deploy) basta.

export const AUTOMATIONS_BETA_EMAILS: string[] | "*" = [
  "marcelbodenhamtamarit@gmail.com",
]

export function isBetaUser(email: string | null | undefined): boolean {
  if (AUTOMATIONS_BETA_EMAILS === "*") return true
  if (!email) return false
  const target = email.toLowerCase()
  return AUTOMATIONS_BETA_EMAILS.some((e) => e.toLowerCase() === target)
}
