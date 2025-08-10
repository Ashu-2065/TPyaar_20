import type React from "react"
import type { Metadata } from "next"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import PWARegister from "@/components/pwa-register"
import AuthProvider from "@/components/auth-provider"

export const metadata: Metadata = {
  title: "TPyaar",
  description: "TPyaar — your colorful AI companion",
  applicationName: "TPyaar",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icons/tp-192.png",
    apple: "/icons/tp-192.png",
  },
    generator: 'v0.dev'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="icon" href="/icons/tp-192.png" />
        <meta name="theme-color" content="#8b5cf6" />
      </head>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
        <PWARegister />
      </body>
    </html>
  )
}
