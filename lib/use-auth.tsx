"use client"

import { createContext, useContext, useEffect, useState } from "react"
import type { User } from "@supabase/supabase-js"
import { supabase } from "./supabase"

// "loading": comprobando si hay sesión guardada.
// "out": nadie logueado -> mostrar login/signup.
// "in": sesión activa -> mostrar la app, con datos aislados por RLS.
type Mode = "loading" | "out" | "in"

const AuthContext = createContext<{
  mode: Mode
  user: User | null
  signOut: () => void
}>({
  mode: "loading",
  user: null,
  signOut: () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<Mode>("loading")
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setUser(data.session.user)
        setMode("in")
      } else {
        setMode("out")
      }
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) {
        setUser(session.user)
        setMode("in")
      } else {
        setUser(null)
        setMode("out")
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const signOut = () => {
    supabase.auth.signOut()
    setMode("out")
  }

  return (
    <AuthContext.Provider value={{ mode, user, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
