"use client"

import { useState } from "react"
import { Dumbbell } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/lib/use-auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"

export function LoginScreen() {
  const { enterAsGuest } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    setLoading(true)
    setError("")
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError("Email o contrasena incorrectos")
    setLoading(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm p-6">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Dumbbell className="size-6" />
          </div>
          <div>
            <p className="text-lg font-semibold">MarcelOS</p>
            <p className="text-xs text-muted-foreground">Mi dia a dia</p>
          </div>
        </div>

        <div className="space-y-3">
          <Input
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          />
          <Input
            placeholder="Contrasena"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <Button onClick={handleLogin} disabled={loading} className="w-full">
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </div>

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">o</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <Button variant="outline" onClick={enterAsGuest} className="w-full">
          Entrar como visitante
        </Button>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          Los visitantes solo ven el Resumen, sin poder modificar nada.
        </p>
      </Card>
    </div>
  )
}
