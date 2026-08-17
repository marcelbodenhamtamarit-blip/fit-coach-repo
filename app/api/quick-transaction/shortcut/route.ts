import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { buildQuickAddShortcut } from "@/lib/build-quick-add-shortcut"

// Cliente con service_role: solo para comprobar que el token existe (no
// hace falta sesión de Supabase Auth aquí, el propio token ya autentica,
// igual que /api/quick-transaction).
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// Genera y sirve el archivo .shortcut (Atajos de iOS) personalizado del
// usuario dueño de `token`, listo para descargar desde Ajustes o abrir
// directamente vía shortcuts://import-shortcut?url=...
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")?.trim()
  if (!token) {
    return NextResponse.json({ error: "Falta el parámetro token" }, { status: 400 })
  }

  const { data } = await supabase
    .from("quick_add_tokens")
    .select("user_id")
    .eq("token", token)
    .maybeSingle()

  if (!data?.user_id) {
    return NextResponse.json({ error: "Token no válido" }, { status: 401 })
  }

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
