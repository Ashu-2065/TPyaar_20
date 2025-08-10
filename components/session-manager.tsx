"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { Trash2 } from "lucide-react"
import { useAuth } from "@/components/auth-provider"

type Session = { id: string; title: string; size_bytes: number; created_at: string; updated_at: string }

export default function SessionManager() {
  const { getAccessToken, user } = useAuth()
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [sessions, setSessions] = React.useState<Session[]>([])
  const [total, setTotal] = React.useState(0)
  const [limit, setLimit] = React.useState(100 * 1024 * 1024)

  const refresh = React.useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const token = await getAccessToken()
      const res = await fetch("/api/history/list", {
        headers: { authorization: token ? `Bearer ${token}` : "" },
      })
      const data = await res.json()
      setSessions(data.sessions || [])
      setTotal(data.total_bytes || 0)
      setLimit(data.limit || limit)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [getAccessToken, user, limit])

  React.useEffect(() => {
    if (open) refresh()
  }, [open, refresh])

  const del = async (id: string) => {
    const token = await getAccessToken()
    const res = await fetch("/api/history/delete-session", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: token ? `Bearer ${token}` : "" },
      body: JSON.stringify({ sessionId: id }),
    })
    if (res.ok) refresh()
  }

  const percent = Math.min(100, Math.round((total / limit) * 100))

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">Manage History</Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Chat History</DialogTitle>
        </DialogHeader>
        {!user ? (
          <p className="text-sm text-muted-foreground">Sign in to manage your history.</p>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-sm mb-2">
                <span>Storage used</span>
                <span>
                  {(total / (1024 * 1024)).toFixed(1)} MB / {(limit / (1024 * 1024)).toFixed(0)} MB ({percent}%)
                </span>
              </div>
              <Progress value={percent} />
              {total >= limit && (
                <p className="text-sm text-destructive mt-2">
                  Storage full. Continue karne ke liye kisi session ko delete karna hoga.
                </p>
              )}
            </div>
            <div className="divide-y border rounded-md">
              {loading ? (
                <div className="p-3 text-sm text-muted-foreground">Loading…</div>
              ) : sessions.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground">No sessions yet.</div>
              ) : (
                sessions.map((s) => (
                  <div key={s.id} className="flex items-center justify-between p-3">
                    <div>
                      <div className="font-medium">{s.title || "Untitled"}</div>
                      <div className="text-xs text-muted-foreground">
                        {(s.size_bytes / (1024 * 1024)).toFixed(2)} MB • {new Date(s.updated_at).toLocaleString()}
                      </div>
                    </div>
                    <Button variant="destructive" size="sm" onClick={() => del(s.id)}>
                      <Trash2 className="h-4 w-4 mr-1" /> Delete
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
