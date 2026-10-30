"use client"

import { createContext, useContext, useEffect, useState } from "react"
import type { Session, User } from "@supabase/supabase-js"
import { supabase } from "./supabase"

// "loading": comprobando si hay sesión guardada.
// "out": nadie logueado -> mostrar login/signup.
// "in": sesión activa -> mostrar la app, con datos aislados por RLS.
type Mode = "loading" | "out" | "in"

// App de uso personal: solo estas cuentas pueden entrar, da igual si viene
// por email/contraseña o por "Continuar con Google" (ese botón no pasa por
// el código de invitación de login-screen.tsx, así que sin esto cualquiera
// con cuenta de Google se colaba). Pon tu email en NEXT_PUBLIC_OWNER_EMAIL
// en Vercel. Si esa variable no está puesta, no bloqueamos a nadie -- por
// eso es importante no olvidarse de configurarla en producción.
//
// NEXT_PUBLIC_PARTNER_EMAIL (opcional) deja entrar además a una segunda
// cuenta -- la de la pareja, con su propio apartado de ahorro (ver
// components/sections/partner-savings-section.tsx) y nada más: no ve
// Economía, Inversiones ni Winter Arc. Sin esta variable puesta, solo
// existe la cuenta de siempre (owner); con ella puesta pero sin que esa
// persona se haya creado todavía la cuenta, simplemente nadie con ese email
// ha entrado aún -- no hace falta nada más aquí.
const OWNER_EMAIL = (process.env.NEXT_PUBLIC_OWNER_EMAIL ?? "").trim().toLowerCase()
const PARTNER_EMAIL = (process.env.NEXT_PUBLIC_PARTNER_EMAIL ?? "").trim().toLowerCase()

// "owner" = tu cuenta (o cualquiera, si NEXT_PUBLIC_OWNER_EMAIL no está
// puesta -- fallback deliberado, ver arriba). "partner" = la cuenta de tu
// pareja, solo si coincide con NEXT_PUBLIC_PARTNER_EMAIL. null = sesión
// bloqueada/sin iniciar.
export type Role = "owner" | "partner" | null

function roleFor(email: string | null | undefined): Role {
  const normalized = (email ?? "").trim().toLowerCase()
  if (PARTNER_EMAIL && normalized === PARTNER_EMAIL) return "partner"
  if (!OWNER_EMAIL || normalized === OWNER_EMAIL) return "owner"
  return null
}

const AuthContext = createContext<{
  mode: Mode
  user: User | null
  role: Role
  // Se puso true la última vez que alguien (o una sesión vieja) consiguió
  // iniciar sesión con un email que no es el tuyo ni el de tu pareja -- se
  // usa en login-screen para explicar por qué se le cerró la sesión al
  // instante.
  blocked: boolean
  signOut: () => void
}>({
  mode: "loading",
  user: null,
  role: null,
  blocked: false,
  signOut: () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<Mode>("loading")
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<Role>(null)
  const [blocked, setBlocked] = useState(false)

  useEffect(() => {
    function handleSession(session: Session | null) {
      const sessionRole = session ? roleFor(session.user.email) : null
      if (session && !sessionRole) {
        // Alguien que no eres tú ni tu pareja ha conseguido sesión
        // (típicamente por Google, que no pasa por el código de invitación).
        // La cerramos al instante -- nunca llega a ver nada de la app.
        supabase.auth.signOut()
        setUser(null)
        setRole(null)
        setBlocked(true)
        setMode("out")
        return
      }
      if (session) {
        setUser(session.user)
        setRole(sessionRole)
        setMode("in")
      } else {
        setUser(null)
        setRole(null)
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
    <AuthContext.Provider value={{ mode, user, role, blocked, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
