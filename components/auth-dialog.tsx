"use client"
import { useState } from "react"
import type React from "react"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/components/auth-provider"

export default function AuthDialog({ children }: { children: React.ReactNode }) {
  const { signIn, signUp } = useAuth()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<"in" | "up">("in")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const submit = async () => {
    setErr(null)
    setLoading(true)
    try {
      if (tab === "in") await signIn(email, password)
      else await signUp(email, password)
      setOpen(false)
    } catch (e: any) {
      setErr(e?.message || "Auth failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{tab === "in" ? "Sign in to TPyaar" : "Create your TPyaar account"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Button variant={tab === "in" ? "default" : "secondary"} onClick={() => setTab("in")}>
              Sign in
            </Button>
            <Button variant={tab === "up" ? "default" : "secondary"} onClick={() => setTab("up")}>
              Sign up
            </Button>
          </div>
          <Input placeholder="you@example.com" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {err && <p className="text-sm text-destructive">{err}</p>}
          <Button onClick={submit} disabled={loading}>
            {loading ? "Please wait…" : tab === "in" ? "Sign in" : "Create account"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Email/password auth is powered by Supabase. You can enable email confirmations in your project. [^3][^5]
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
