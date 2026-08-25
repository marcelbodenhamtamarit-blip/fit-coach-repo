import { createHash } from "crypto"
import type { SupabaseClient } from "@supabase/supabase-js"

// Compartido por los 3 endpoints que autentican con el token personal de
// quick_add_tokens (/api/quick-transaction, y las dos rutas que sirven el
// .shortcut). Autenticar comparando el hash SHA-256 en vez del texto del
// token directamente evita que ese texto plano tenga que pasar por la
// lógica de autenticación en sí — la tabla sigue guardando también el
// token en claro (lo necesita Ajustes para poder enseñártelo), pero el
// camino de autenticación ya no depende de ese campo.
export function hashQuickAddToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

// Devuelve el user_id dueño del token, o null si no existe. Server-only:
// se le pasa siempre un cliente con la service_role key (salta RLS a
// propósito, igual que el resto de esta ruta).
export async function resolveUserIdByQuickAddToken(
  supabase: SupabaseClient,
  token: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("quick_add_tokens")
    .select("user_id")
    .eq("token_hash", hashQuickAddToken(token))
    .maybeSingle()
  return (data?.user_id as string | undefined) ?? null
}

// "Último uso" que se enseña en Ajustes, para que cada persona pueda notar
// si su token se está usando en un momento raro. Se llama después de
// responder a la petición real (fire-and-forget): si esto falla, no debe
// romper ni retrasar el alta del movimiento en sí.
export function touchQuickAddTokenLastUsed(supabase: SupabaseClient, token: string): void {
  supabase
    .from("quick_add_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("token_hash", hashQuickAddToken(token))
    .then(
      () => {},
      (err: unknown) => console.error("[quick-add-token] error actualizando last_used_at:", err),
    )
}
