"use client"
import Header from "@/components/header"
import Link from "next/link"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export default function Welcome() {
  const [now, setNow] = useState<string>("")
  useEffect(() => {
    const update = () => setNow(new Date().toLocaleString(undefined, { dateStyle: "full", timeStyle: "medium" }))
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <main className="min-h-screen bg-gradient-to-br from-fuchsia-500 via-violet-600 to-emerald-500 text-white">
      <Header />
      <div className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <span className="text-xl font-semibold tracking-wide">Welcome</span>
            </div>
            <Badge className="bg-white/20 text-white backdrop-blur">Live: {now}</Badge>
          </div>

          <Card className="bg-white/10 border-white/20 text-white backdrop-blur">
            <CardHeader>
              <CardTitle className="text-3xl md:text-4xl">TPyaar</CardTitle>
              <p className="text-white/80">Your colorful AI companion with chat voice.</p>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex flex-wrap gap-3 pt-2">
                  <Link href="/chat">
                    <Button size="lg" className="bg-white text-violet-700 hover:bg-white/90">
                      Continue as Guest
                    </Button>
                  </Link>
                </div>
              </div>
              <div className="space-y-3">
                <div className="relative overflow-hidden rounded-xl h-48 ring-1 ring-white/20">
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.35),transparent_60%),radial-gradient(ellipse_at_bottom_right,rgba(255,255,255,0.2),transparent_60%)]" />
                  <div className="absolute -top-10 -left-10 h-40 w-40 rounded-full bg-white/30 blur-2xl animate-pulse" />
                  <div className="absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-white/20 blur-3xl animate-[pulse_3s_ease-in-out_infinite]" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-lg font-semibold">Fast • Colorful • Creative</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <footer className="text-center text-white/80 mt-10">© TPyaar · All rights reserved</footer>
        </div>
      </div>
    </main>
  )
}
