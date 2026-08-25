import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { buildQuickAddShortcut } from "@/lib/build-quick-add-shortcut"
import { resolveUserIdByQuickAddToken, touchQuickAddTokenLastUsed } from "@/lib/quick-add-token.server"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// El segmento [filename] no se usa en el servidor (el token manda quién
// es el dueño), pero tiene que existir: la app Atajos de iOS solo
// reconoce como importable una URL cuya ruta (sin contar el "?...")
// termina en ".shortcut", sin importar el Content-Type que devolvamos.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")?.trim()
  if (!token) {
    return NextResponse.json({ error: "Falta el parámetro token" }, { status: 400 })
  }
  const ownerUserId = await resolveUserIdByQuickAddToken(supabase, token)
  if (!ownerUserId) {
    return NextResponse.json({ error: "Token no válido" }, { status: 401 })
  }
  touchQuickAddTokenLastUsed(supabase, token)
  const baseUrl = req.nextUrl.origin
  const buffer = buildQuickAddShortcut({ baseUrl, token })
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": 'attachment; filename="ZentOS - Anadir gasto.shortcut"',
      "Cache-Control": "no-store",
    },
  })
}
