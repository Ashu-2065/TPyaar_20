"use client"

import * as React from "react"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"

type User = { id: string; email: string | null }
type Ctx = {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  getAccessToken: () => Promise<string | null>
}

const AuthCtx = React.createContext<Ctx | null>(null)

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = React.useMemo(() => getSupabaseBrowserClient(), [])
  const [user, setUser] = React.useState<User | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let mounted = true
    ;(async () => {
      const { data } = await supabase.auth.getUser()
      if (!mounted) return
      if (data.user) setUser({ id: data.user.id, email: data.user.email })
      setLoading(false)
    })()
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user
      setUser(u ? { id: u.id, email: u.email } : null)
    })
    return () => {
      sub.subscription.unsubscribe()
      mounted = false
    }
  }, [supabase])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }
  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
  }
  const signOut = async () => {
    await supabase.auth.signOut()
  }
  const getAccessToken = async () => {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token || null
  }

  const value: Ctx = { user, loading, signIn, signUp, signOut, getAccessToken }
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export function useAuth() {
  const ctx = React.useContext(AuthCtx)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
