"use client"

import { createContext, useContext, useEffect, useState } from "react"
import type { Session, User } from "@supabase/supabase-js"
import { supabase } from "./supabase"

// "loading": comprobando si hay sesión guardada.
// "out": nadie logueado -> mostrar login/signup.
// "in": sesión activa -> mostrar la app, con datos aislados por RLS.
type Mode = "loading" | "out" | "in"

// App de uso personal: solo esta cuenta puede entrar, da igual si viene por
// email/contraseña o por "Continuar con Google" (ese botón no pasa por el
// código de invitación de login-screen.tsx, así que sin esto cualquiera con
// cuenta de Google se colaba). Pon tu email en NEXT_PUBLIC_OWNER_EMAIL en
// Vercel. Si esa variable no está puesta, no bloqueamos a nadie -- por eso
// es importante no olvidarse de configurarla en producción.
const OWNER_EMAIL = (process.env.NEXT_PUBLIC_OWNER_EMAIL ?? "").trim().toLowerCase()

function isOwner(email: string | null | undefined): boolean {
  if (!OWNER_EMAIL) return true
  return (email ?? "").trim().toLowerCase() === OWNER_EMAIL
}

const AuthContext = createContext<{
  mode: Mode
  user: User | null
  // Se puso true la última vez que alguien (o una sesión vieja) consiguió
  // iniciar sesión con un email que no es el tuyo -- se usa en login-screen
  // para explicar por qué se le cerró la sesión al momento.
  blocked: boolean
  signOut: () => void
}>({
  mode: "loading",
  user: null,
  blocked: false,
  signOut: () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<Mode>("loading")
  const [user, setUser] = useState<User | null>(null)
  const [blocked, setBlocked] = useState(false)

  useEffect(() => {
    function handleSession(session: Session | null) {
      if (session && !isOwner(session.user.email)) {
        // Alguien que no eres tú ha conseguido sesión (típicamente por
        // Google, que no pasa por el código de invitación). La cerramos al
        // instante -- nunca llega a ver nada de la app.
        supabase.auth.signOut()
        setUser(null)
        setBlocked(true)
        setMode("out")
        return
      }
      if (session) {
        setUser(session.user)
        setMode("in")
      } else {
        setUser(null)
        setMode("out")
      }
    }

    supabase.auth.getSession().then(({ data }) => handleSession(data.session))

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      handleSession(session)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const signOut = () => {
    supabase.auth.signOut()
    setMode("out")
  }

  return (
    <AuthContext.Provider value={{ mode, user, blocked, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
