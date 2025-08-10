"use client"

import type React from "react"

import Header from "@/components/header"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Mic, Copy, Trash2, Download, Maximize2, Volume2, VolumeX, Clipboard, ShieldAlert } from "lucide-react"
import { cn } from "@/lib/utils"
import MarkdownMessage from "@/components/markdown-message"
import { useAuth } from "@/components/auth-provider"

type ChatMode = "normal" | "bf" | "gf"
type LangPref = "auto" | "english" | "hinglish" | "marwadi"
type Attachment = { id: string; kind: "image" | "video" | "audio"; url: string; name: string; blob?: Blob }
type ChatMessage = {
  id: string
  role: "user" | "assistant"
  text: string
  attachments?: Attachment[]
  tts?: boolean
  streaming?: boolean
}

const ADULT_ALLOWED = typeof window !== "undefined" ? process.env.NEXT_PUBLIC_ALLOW_ADULT_CONTENT === "true" : false
const QUOTA_BYTES = 100 * 1024 * 1024

function useLocalStorage<T>(key: string, initial: T) {
  const [state, setState] = useState<T>(() => {
    if (typeof window === "undefined") return initial
    try {
      const raw = localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : initial
    } catch {
      return initial
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state))
    } catch {}
  }, [key, state])
  return [state, setState] as const
}

function isImageType(type: string) {
  return type.startsWith("image/")
}
function isVideoType(type: string) {
  return type.startsWith("video/")
}
function isAudioType(type: string) {
  return type.startsWith("audio/")
}
function dataURLFromBlob(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onerror = rej
    r.onload = () => res(r.result as string)
    r.readAsDataURL(blob)
  })
}
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export default function TPyaarChat() {
  const { user, getAccessToken } = useAuth()
  const [mode, setMode] = useLocalStorage<ChatMode>("tpyaar:mode", "normal")
  const [lang, setLang] = useLocalStorage<LangPref>("tpyaar:lang", "auto")
  const [messages, setMessages] = useLocalStorage<ChatMessage[]>("tpyaar:messages", [])
  const [input, setInput] = useState("")
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([])
  const [lightbox, setLightbox] = useState<Attachment | null>(null)
  const [adultConsent, setAdultConsent] = useLocalStorage<boolean>("tpyaar:adult-consent", false)
  const [typedGenerators, setTypedGenerators] = useLocalStorage<boolean>("tpyaar:typed-gen", false)
  const [sessionId, setSessionId] = useLocalStorage<string | null>("tpyaar:session-id", null)
  const [overQuota, setOverQuota] = useState(false)

  const onFilesSelected = (files: FileList | null) => {
    if (!files) return
    const arr: Attachment[] = []
    ;[...files].forEach((file) => {
      const kind: Attachment["kind"] = isImageType(file.type)
        ? "image"
        : isVideoType(file.type)
          ? "video"
          : isAudioType(file.type)
            ? "audio"
            : "image"
      const url = URL.createObjectURL(file)
      arr.push({ id: crypto.randomUUID(), kind, url, name: file.name, blob: file })
    })
    setPendingAttachments((prev) => [...prev, ...arr])
  }

  const copyMessage = async (m: ChatMessage) => {
    await navigator.clipboard.writeText(m.text)
  }
  const toggleSpeak = (m: ChatMessage) => {
    if (m.role !== "assistant" || m.streaming) return
    const next = { ...m, tts: !m.tts }
    setMessages((prev) => prev.map((x) => (x.id === m.id ? next : x)))
    if (next.tts) {
      const u = new SpeechSynthesisUtterance(next.text)
      window.speechSynthesis.speak(u)
    } else {
      window.speechSynthesis.cancel()
    }
  }
  const finalizeAssistant = (id: string, text: string) => {
    const safeText =
      text && text.trim().length > 0
        ? text
        : "Sorry, response unavailable at the moment. Please try again in a few seconds."
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, text: safeText, streaming: false } : m)))
    // After finalizing, try saving this turn (user + assistant) if signed in
    if (user && !overQuota) {
      const lastTwo = (() => {
        const arr = [...messages]
        const assistant = arr.find((m) => m.id === id)
        const userMsg = [...arr].reverse().find((m) => m.role === "user")
        if (!assistant || !userMsg) return []
        return [
          { role: "user" as const, content: userMsg.text },
          { role: "assistant" as const, content: safeText },
        ]
      })()
      if (lastTwo.length) {
        saveTurn(lastTwo)
      }
    }
  }

  async function saveTurn(turn: { role: "user" | "assistant"; content: string }[]) {
    try {
      const token = await getAccessToken()
      if (!token) return
      const res = await fetch("/api/history/save", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({
          sessionId: sessionId || undefined,
          title: messages[0]?.text || "New Chat",
          messages: turn,
        }),
      })
      if (res.status === 409) {
        setOverQuota(true)
        return
      }
      const data = await res.json()
      if (data?.sessionId && !sessionId) setSessionId(data.sessionId)
      if (data?.usage && data?.limit && data.usage >= data.limit) setOverQuota(true)
    } catch {
      // ignore saving errors to not block chat UX
    }
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault()
    if (!input.trim() && pendingAttachments.length === 0) return

    if (ADULT_ALLOWED && (mode === "bf" || mode === "gf") && !adultConsent) {
      const ok = confirm("You are requesting adult content. Confirm you are 18+ and accept responsibility. Continue?")
      if (!ok) return
      setAdultConsent(true)
    }

    // Typed media triggers (optional)
    if (typedGenerators && /^\/img:/i.test(input)) {
      const prompt = input.replace(/^\/img:\s*/i, "")
      const tempId = crypto.randomUUID()
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "user", text: input },
        { id: tempId, role: "assistant", text: "Generating image…", streaming: true },
      ])
      try {
        const r = await fetch("/api/media/generate-image", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ prompt }),
        })
        const j = await r.json()
        const dataUrl = j?.dataUrl as string | undefined
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId
              ? { ...m, text: dataUrl ? `![image](${dataUrl})` : j?.error || "No image returned", streaming: false }
              : m,
          ),
        )
      } catch (err: any) {
        finalizeAssistant(tempId, `Image error: ${err?.message || "Unknown"}`)
      }
      setInput("")
      return
    }
    if (typedGenerators && /^\/video:/i.test(input)) {
      const prompt = input.replace(/^\/video:\s*/i, "")
      const tempId = crypto.randomUUID()
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "user", text: input },
        { id: tempId, role: "assistant", text: "Generating video…", streaming: true },
      ])
      try {
        const r = await fetch("/api/media/generate-video", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ prompt }),
        })
        const j = await r.json()
        const uri = j?.uri || j?.dataUrl
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId
              ? { ...m, text: uri ? `Video: ${uri}` : j?.error || "No video returned", streaming: false }
              : m,
          ),
        )
      } catch (err: any) {
        finalizeAssistant(tempId, `Video error: ${err?.message || "Unknown"}`)
      }
      setInput("")
      return
    }

    const attachmentsToSend = pendingAttachments
    setPendingAttachments([])

    const newUserMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text: input,
      attachments: attachmentsToSend.length ? attachmentsToSend : undefined,
    }
    setMessages((prev) => [...prev, newUserMsg])
    setInput("")

    const hasNonImage = attachmentsToSend.some((a) => a.kind !== "image")
    if (hasNonImage) {
      const reply: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        text: "Sorry, I can’t access folders, videos, or audio in this preview. Please send a single image (JPG/PNG/WebP) for analysis.",
      }
      setMessages((prev) => [...prev, reply])
      return
    }

    const imageOnly = attachmentsToSend.filter((a) => a.kind === "image")
    if (imageOnly.length > 0) {
      const first = imageOnly[0]
      const tempId = crypto.randomUUID()
      setMessages((prev) => [...prev, { id: tempId, role: "assistant", text: "Analyzing image…", streaming: true }])
      try {
        const dataUrl = first.blob ? await dataURLFromBlob(first.blob) : first.url
        const res = await fetch("/api/analyze-image", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            dataUrl,
            prompt: newUserMsg.text || "Describe this image and provide insights.",
            lang,
            mode,
          }),
        })
        const { text } = await res.json()
        finalizeAssistant(tempId, text || "No description returned.")
      } catch (err: any) {
        finalizeAssistant(tempId, `Image analysis error: ${err?.message || "Unknown"}`)
      }
      return
    }

    const tempId = crypto.randomUUID()
    setMessages((prev) => [...prev, { id: tempId, role: "assistant", text: "", streaming: true }])

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode,
          lang,
          model: "gemini-2.5-pro",
          strict: false,
          adultAccepted: ADULT_ALLOWED && (mode === "bf" || mode === "gf") && adultConsent,
          messages: [...messages, newUserMsg].map((m) => ({ role: m.role, content: m.text })),
        }),
      })

      if (!res.ok || !res.body) {
        const txt = await res.text().catch(() => "Error")
        finalizeAssistant(tempId, `Sorry, I couldn't process that. ${txt}`)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let acc = ""
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        acc += decoder.decode(value, { stream: true })
        setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, text: acc } : m)))
      }
      acc += decoder.decode()
      if (acc.trim().length === 0) {
        const simple = await fetch("/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            mode,
            lang,
            model: "gemini-2.5-pro",
            strict: false,
            forceSimple: true,
            adultAccepted: ADULT_ALLOWED && (mode === "bf" || mode === "gf") && adultConsent,
            messages: [...messages, newUserMsg].map((m) => ({ role: m.role, content: m.text })),
          }),
        })
        const data = await simple.json().catch(() => ({}) as any)
        finalizeAssistant(
          tempId,
          (data?.text as string) || "Sorry, response unavailable at the moment. Please try again in a few seconds.",
        )
        return
      }
      finalizeAssistant(tempId, acc)
    } catch (err: any) {
      finalizeAssistant(tempId, `Error: ${err?.message || "Unknown error"}`)
    }
  }

  const downloadChat = async () => {
    const text = messages.map((m) => `${m.role === "user" ? "You" : "TPyaar"}: ${m.text}`).join("\n\n")
    const blob = new Blob([text], { type: "text/plain" })
    downloadBlob(blob, "tpyaar-chat.txt")
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-emerald-50 via-fuchsia-50 to-violet-50 dark:from-[#0b1020] dark:via-[#0e1226] dark:to-[#0c0f1e]">
      <Header />
      {ADULT_ALLOWED && (mode === "bf" || mode === "gf") && (
        <div className="container mx-auto px-4 pt-3">
          <div className="rounded-lg border bg-amber-50 dark:bg-amber-900/20 text-amber-900 dark:text-amber-300 p-3 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" />
            <span>Adult content is enabled by env. Consent: {adultConsent ? "Accepted" : "Not accepted"}</span>
          </div>
        </div>
      )}
      <div className="container mx-auto p-4 max-w-5xl">
        <Card className="border bg-white/70 dark:bg-white/5 backdrop-blur">
          <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 via-fuchsia-600 to-violet-600">
                TPyaar — AI Chatbot
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Live: {new Date().toLocaleString(undefined, { dateStyle: "full", timeStyle: "medium" })}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Label htmlFor="mode">Mode</Label>
                <Select value={mode} onValueChange={(v: ChatMode) => setMode(v)}>
                  <SelectTrigger id="mode" className="w-[160px]">
                    <SelectValue placeholder="Mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="bf">Boyfriend</SelectItem>
                    <SelectItem value="gf">Girlfriend</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="lang">Language</Label>
                <Select value={lang} onValueChange={(v: LangPref) => setLang(v)}>
                  <SelectTrigger id="lang" className="w-[160px]">
                    <SelectValue placeholder="Language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto</SelectItem>
                    <SelectItem value="english">English</SelectItem>
                    <SelectItem value="hinglish">Hinglish</SelectItem>
                    <SelectItem value="marwadi">Marwadi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {user ? (
              <div className="text-xs text-muted-foreground">
                Signed in as {user.email}.{" "}
                {overQuota && (
                  <span className="text-destructive ml-1">
                    Storage full — delete a session in “Manage History” to continue saving.
                  </span>
                )}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">
                You’re in guest mode. Sign in to save your chat history (100 MB per user).
              </div>
            )}
            <div className="h-[56vh] w-full overflow-y-auto rounded-md border p-3 bg-muted/30">
              <div className="space-y-4">
                {messages.map((m) => (
                  <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[85%] rounded-lg p-3 space-y-2",
                        m.role === "user"
                          ? "bg-white text-foreground dark:bg-white"
                          : "bg-white dark:bg-zinc-900 text-foreground ring-1 ring-border",
                      )}
                    >
                      {m.role === "assistant" ? (
                        <MarkdownMessage content={m.text || ""} />
                      ) : (
                        <div className="whitespace-pre-wrap text-sm">{m.text}</div>
                      )}
                      <div className="flex items-center gap-2 pt-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => copyMessage(m)}
                          aria-label="Copy message"
                        >
                          <Clipboard className="h-4 w-4" />
                        </Button>
                        {m.role === "assistant" && !m.streaming && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => toggleSpeak(m)}
                            aria-label={m.tts ? "Speaker off" : "Speaker on"}
                          >
                            {m.tts ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                          </Button>
                        )}
                      </div>
                      {m.attachments && m.attachments.length > 0 && (
                        <div className="grid grid-cols-2 gap-2">
                          {m.attachments.map((att) => (
                            <div
                              key={att.id}
                              className="group relative rounded-md overflow-hidden border bg-background"
                            >
                              {att.kind === "image" && (
                                <button
                                  onClick={() => setLightbox(att)}
                                  className="relative block"
                                  aria-label="Open image"
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={att.url || "/placeholder.svg?height=160&width=240&query=image%20attachment"}
                                    alt={att.name}
                                    className="object-cover w-full h-40"
                                  />
                                  <div className="absolute bottom-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                                    <Button
                                      size="icon"
                                      variant="secondary"
                                      className="h-7 w-7"
                                      onClick={(e) => {
                                        e.preventDefault()
                                        setLightbox(att)
                                      }}
                                    >
                                      <Maximize2 className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="secondary"
                                      className="h-7 w-7"
                                      onClick={(e) => {
                                        e.preventDefault()
                                        if (att.blob) downloadBlob(att.blob, att.name)
                                      }}
                                    >
                                      <Download className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </button>
                              )}
                              {att.kind === "video" && (
                                <video src={att.url} controls className="w-full h-40 object-cover" />
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {pendingAttachments.length > 0 && (
              <div className="rounded-md border p-3">
                <div className="text-sm mb-2">Attachments to send</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {pendingAttachments.map((att) => (
                    <div key={att.id} className="relative border rounded-md overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {att.kind === "image" ? (
                        <img
                          src={att.url || "/placeholder.svg?height=120&width=180&query=pending%20image"}
                          alt={att.name}
                          className="w-full h-28 object-cover"
                        />
                      ) : att.kind === "video" ? (
                        <video src={att.url} className="w-full h-28 object-cover" />
                      ) : (
                        <div className="p-2 text-xs">{att.name}</div>
                      )}
                      <button
                        className="absolute top-1 right-1 bg-background/70 rounded p-1 text-xs"
                        onClick={() => setPendingAttachments((prev) => prev.filter((p) => p.id !== att.id))}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>

          <CardFooter className="flex flex-col gap-3">
            <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-2 w-full">
              <div className="flex gap-2 w-full">
                <Textarea
                  placeholder="Type your message… (Sign in to save history; 100 MB per user)"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  className="min-h-[44px]"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-2" title="Upload files">
                  <Input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => onFilesSelected(e.target.files)}
                    accept="image/*,video/*,audio/*"
                  />
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() => {
                      const el = document.createElement("input")
                      el.type = "file"
                      el.multiple = true
                      el.accept = "image/*,video/*,audio/*"
                      el.onchange = () => onFilesSelected((el as HTMLInputElement).files)
                      el.click()
                    }}
                  >
                    Upload
                  </Button>
                </label>
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => {
                    const anyNav = window as any
                    const Rec = anyNav.SpeechRecognition || anyNav.webkitSpeechRecognition
                    if (!Rec) return alert("Voice not supported")
                    const r = new Rec()
                    r.lang = "en-US"
                    r.interimResults = false
                    r.onresult = (e: any) => setInput((prev) => (prev ? prev + " " : "") + e.results[0][0].transcript)
                    r.start()
                  }}
                >
                  <Mic className="h-4 w-4 mr-2" /> Voice
                </Button>
                <Button type="submit">Send</Button>
              </div>
            </form>
            <div className="flex items-center justify-between w-full">
              <div className="text-xs text-muted-foreground">
                TPyaar can make mistakes. Check important info. See Cookie Preferences.
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    const text = messages.map((m) => `${m.role === "user" ? "You" : "TPyaar"}: ${m.text}`).join("\n\n")
                    await navigator.clipboard.writeText(text)
                  }}
                >
                  <Copy className="h-4 w-4 mr-2" /> Copy Chat
                </Button>
                <Button variant="outline" size="sm" onClick={downloadChat}>
                  <Download className="h-4 w-4 mr-2" /> Download .txt
                </Button>
                <Button variant="destructive" size="sm" onClick={() => setMessages([])}>
                  <Trash2 className="h-4 w-4 mr-2" /> Clear
                </Button>
              </div>
            </div>
          </CardFooter>
        </Card>
        {lightbox && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
            <div className="relative max-w-5xl w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lightbox.url || "/placeholder.svg?height=360&width=640&query=lightbox%20image"}
                alt={lightbox.name}
                className="w-full max-h-[80vh] object-contain rounded-md"
              />
              <div className="absolute top-2 right-2 flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    if (lightbox.blob) downloadBlob(lightbox.blob, lightbox.name)
                  }}
                >
                  <Download className="h-4 w-4 mr-2" /> Download
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setLightbox(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

