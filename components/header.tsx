"use client"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import ThemeToggle from "@/components/theme-toggle"
import AuthDialog from "@/components/auth-dialog"
import { useAuth } from "@/components/auth-provider"
import PWAInstall from "@/components/pwa-install"
import SessionManager from "@/components/session-manager"

export default function Header() {
  const { user, signOut } = useAuth()
  return (
    <header className="w-full border-b bg-background/70 backdrop-blur">
      <div className="container mx-auto px-4 py-3 flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/tp-48.png"
            alt="TP"
            className="h-7 w-7 rounded"
            onError={(e) => {
              const img = e.currentTarget as HTMLImageElement
              if (img.src.endsWith("/icons/tp-48.png")) img.src = "/icons/tp-192.png"
            }}
          />
          <span className="text-base font-semibold tracking-wide">TPyaar</span>
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <Badge variant="secondary" className="hidden sm:inline-flex">
            Live
          </Badge>
          <ThemeToggle />
          <SessionManager />
          {!user ? (
            <AuthDialog>
              <Button variant="secondary">Sign in</Button>
            </AuthDialog>
          ) : (
            <>
              <span className="text-xs sm:text-sm text-muted-foreground hidden md:inline">{user.email}</span>
              <Button variant="secondary" onClick={signOut}>
                Sign out
              </Button>
            </>
          )}
          <PWAInstall>
            <Button variant="secondary">Install App</Button>
          </PWAInstall>
          <Link href="/chat">
            <Button>Open Chat</Button>
          </Link>
        </div>
      </div>
    </header>
  )
}
