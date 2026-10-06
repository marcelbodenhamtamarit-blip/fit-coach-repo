import { supabase } from "@/lib/supabase"

// Backup best-effort de cada movimiento a Google Sheets, ver
// app/api/sheets-backup/route.ts. Nunca lanza: devuelve si funcionó o no,
// y cada llamador decide si eso merece avisar al usuario (toast) o
// ignorarlo en silencio, igual que antes.
export async function backupToSheets(entry: {
  week: number
  category: string
  amount: string
  date: string
}): Promise<boolean> {
  try {
    const { data: sessionData } = await supabase.auth.getSession()
    const accessToken = sessionData.session?.access_token
    if (!accessToken) return false

    const res = await fetch("/api/sheets-backup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(entry),
    })
    return res.ok
  } catch {
    return false
  }
}
