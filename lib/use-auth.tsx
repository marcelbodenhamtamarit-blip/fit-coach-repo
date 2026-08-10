"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { supabase } from "./supabase"

type Mode = "loading" | "out" | "guest" | "owner"

const AuthContext = createContext<{
  mode: Mode
  isOwner: boolean
  enterAsGuest: () => void
  signOut: () => void
}>({
  mode: "loading",
  isOwner: false,
  enterAsGuest: () => {},
  signOut: () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<Mode>("loading")

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setMode("owner")
      } else if (typeof window !== "undefined" && sessionStorage.getItem("guest") === "1") {
        setMode("guest")
      } else {
        setMode("out")
      }
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) {
        setMode("owner")
      } else {
        setMode(sessionStorage.getItem("guest") === "1" ? "guest" : "out")
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const enterAsGuest = () => {
    sessionStorage.setItem("guest", "1")
    setMode("guest")
  }

  const signOut = () => {
    sessionStorage.removeItem("guest")
    supabase.auth.signOut()
    setMode("out")
  }

  return (
    <AuthContext.Provider value={{ mode, isOwner: mode === "owner", enterAsGuest, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
