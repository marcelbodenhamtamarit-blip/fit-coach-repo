"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { translate, type Language } from "@/lib/i18n"

// Antes de iniciar sesión no existe todavía una cuenta (ni fila en
// user_preferences), así que el idioma elegido en Ajustes no está
// disponible aquí — es el problema clásico del huevo y la gallina. En vez
// de mostrar siempre español, adivinamos con el idioma del navegador la
// primera vez, y dejamos un botón pequeño para cambiarlo a mano si acierta
// mal. Esta elección es solo de esta pantalla; en cuanto la persona entra,
// pasa a mandar su propia preferencia guardada en la cuenta.
function detectBrowserLanguage(): Language {
  if (typeof navigator === "undefined") return "es"
  return navigator.language?.toLowerCase().startsWith("en") ? "en" : "es"
}

// Código de invitación simple para la fase "amigos": mientras esté puesto
// en el entorno, hace falta conocerlo para poder crear cuenta. Cuando
// quieras abrir la app a cualquiera, borra la variable de entorno
// NEXT_PUBLIC_INVITE_CODE en Vercel y este control desaparece solo.
const INVITE_CODE = process.env.NEXT_PUBLIC_INVITE_CODE ?? ""

type ViewMode = "login" | "signup"

export function LoginScreen() {
  const [lang, setLang] = useState<Language>(detectBrowserLanguage)
  const tr = (key: Parameters<typeof translate>[0], params?: Record<string, string | number>) =>
    translate(key, lang, params)

  const [view, setView] = useState<ViewMode>("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [inviteCode, setInviteCode] = useState("")
  const [error, setError] = useState("")
  const [info, setInfo] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    setError("")
    setInfo("")
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(tr("login.wrongCredentials"))
    setLoading(false)
  }

  async function handleSignup() {
    setError("")
    setInfo("")

    if (INVITE_CODE && inviteCode.trim() !== INVITE_CODE) {
      setError(tr("login.wrongInvite"))
      return
    }
    if (password.length < 6) {
      setError(tr("login.passwordTooShort"))
      return
    }

    setLoading(true)
    const { data, error } = await supabase.auth.signUp({ email, password })
    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    // Si en Supabase tienes activada la confirmación por email, no habrá
    // sesión todavía y hay que avisar al usuario para que revise su correo.
    if (data.session) {
      // Sesión creada al instante: onAuthStateChange en useAuth ya lo
      // detecta y te mete dentro de la app.
      return
    }
    setInfo(tr("login.accountCreated"))
  }

  async function handleGoogle() {
    setError("")
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: typeof window !== "undefined" ? window.location.origin : undefined },
    })
  }

  const submit = view === "login" ? handleLogin : handleSignup

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm p-6">
        <div className="mb-4 flex justify-end">
          <div className="flex gap-1 rounded-full border border-border bg-muted/40 p-0.5 text-[11px] font-medium">
            <button
              type="button"
              onClick={() => setLang("es")}
              className={`rounded-full px-2 py-0.5 transition-colors ${
                lang === "es" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              ES
            </button>
            <button
              type="button"
              onClick={() => setLang("en")}
              className={`rounded-full px-2 py-0.5 transition-colors ${
                lang === "en" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              EN
            </button>
          </div>
        </div>

        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="ZentOS" className="size-11 rounded-xl shadow-sm" />

          <div>
            <p className="text-lg font-semibold">ZentOS</p>
            <p className="text-xs text-muted-foreground">{tr("app.tagline")}</p>
          </div>
        </div>

        <div className="mb-5 flex gap-1 rounded-lg border border-border bg-muted/40 p-1">
          <button
            type="button"
            onClick={() => { setView("login"); setError(""); setInfo("") }}
            className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
              view === "login" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            {tr("login.signIn")}
          </button>
          <button
            type="button"
            onClick={() => { setView("signup"); setError(""); setInfo("") }}
            className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
              view === "signup" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            {tr("login.signUp")}
          </button>
        </div>

        <div className="space-y-3">
          <Input
            placeholder={tr("login.emailPlaceholder")}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          <Input
            placeholder={tr("login.passwordPlaceholder")}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          {view === "signup" && INVITE_CODE && (
            <Input
              placeholder={tr("login.invitePlaceholder")}
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          )}
          {error && <p className="text-xs text-red-500">{error}</p>}
          {info && <p className="text-xs text-emerald-500">{info}</p>}
          <Button onClick={submit} disabled={loading || !email || !password} className="w-full">
            {loading ? tr("login.wait") : view === "login" ? tr("login.enter") : tr("login.signUp")}
          </Button>
        </div>

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{tr("login.or")}</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <Button variant="outline" onClick={handleGoogle} className="w-full">
          {tr("login.google")}
        </Button>
      </Card>
    </div>
  )
}
