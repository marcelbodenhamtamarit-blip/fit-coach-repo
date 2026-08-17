"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"

// Código de invitación simple para la fase "amigos": mientras esté puesto
// en el entorno, hace falta conocerlo para poder crear cuenta. Cuando
// quieras abrir la app a cualquiera, borra la variable de entorno
// NEXT_PUBLIC_INVITE_CODE en Vercel y este control desaparece solo.
const INVITE_CODE = process.env.NEXT_PUBLIC_INVITE_CODE ?? ""

type ViewMode = "login" | "signup"

export function LoginScreen() {
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
    if (error) setError("Email o contraseña incorrectos")
    setLoading(false)
  }

  async function handleSignup() {
    setError("")
    setInfo("")

    if (INVITE_CODE && inviteCode.trim() !== INVITE_CODE) {
      setError("Código de invitación incorrecto")
      return
    }
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres")
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
    setInfo("Cuenta creada. Revisa tu email para confirmar la cuenta antes de entrar.")
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
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm p-6">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="ZentOS" className="size-11 rounded-xl shadow-sm" />

          <div>
            <p className="text-lg font-semibold">ZentOS</p>
            <p className="text-xs text-muted-foreground">Tu economía, a tu manera</p>
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
            Iniciar sesión
          </button>
          <button
            type="button"
            onClick={() => { setView("signup"); setError(""); setInfo("") }}
            className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
              view === "signup" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            Crear cuenta
          </button>
        </div>

        <div className="space-y-3">
          <Input
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          <Input
            placeholder="Contraseña"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          {view === "signup" && INVITE_CODE && (
            <Input
              placeholder="Código de invitación"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          )}
          {error && <p className="text-xs text-red-500">{error}</p>}
          {info && <p className="text-xs text-emerald-500">{info}</p>}
          <Button onClick={submit} disabled={loading || !email || !password} className="w-full">
            {loading ? "Un momento..." : view === "login" ? "Entrar" : "Crear cuenta"}
          </Button>
        </div>

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">o</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <Button variant="outline" onClick={handleGoogle} className="w-full">
          Continuar con Google
        </Button>
      </Card>
    </div>
  )
}
