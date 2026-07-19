"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function LoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [open, setOpen] = useState(false)

  async function handleLogin() {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError("Credenciales incorrectas")
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-50 rounded-full bg-card border border-border px-3 py-2 text-xs text-muted-foreground shadow-lg"
      >
        Entrar
      </button>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex w-64 flex-col gap-2 rounded-lg border border-border bg-card p-3 shadow-lg">
      <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <Input placeholder="Contraseña" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" onClick={handleLogin} className="flex-1">Entrar</Button>
        <Button size="sm" variant="outline" onClick={() => setOpen(false)}>×</Button>
      </div>
    </div>
  )
}
