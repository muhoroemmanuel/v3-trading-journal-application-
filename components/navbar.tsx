"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { LineChart, Bell, Settings, WalletCards, BookOpen } from "lucide-react"

export function Navbar() {
  const pathname = usePathname()

  const isActive = (path: string) => {
    return pathname === path
  }

  return (
    <header className="border-b">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl">
            <LineChart className="h-5 w-5" />
            <span>Trading Journal</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            <Link
              href="/"
              className={`text-sm font-medium transition-colors hover:text-primary ${
                isActive("/") ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              Journal
            </Link>
            <Link
              href="/economic-calendar"
              className={`text-sm font-medium transition-colors hover:text-primary ${
                isActive("/economic-calendar") ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              Economic Calendar
            </Link>
            <Link
              href="/accounts"
              className={`text-sm font-medium transition-colors hover:text-primary ${
                isActive("/accounts") ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              Accounts
            </Link>
            <Link
              href="/alerts"
              className={`text-sm font-medium transition-colors hover:text-primary ${
                isActive("/alerts") ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              Alerts
            </Link>
            <Link
              href="/settings"
              className={`text-sm font-medium transition-colors hover:text-primary ${
                isActive("/settings") ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              Settings
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />

          <div className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
            <nav className="mx-auto flex max-w-md items-center justify-around" aria-label="Mobile navigation">
              {[
                { href: "/", label: "Journal", icon: BookOpen },
                { href: "/accounts", label: "Accounts", icon: WalletCards },
                { href: "/alerts", label: "Alerts", icon: Bell },
                { href: "/settings", label: "Settings", icon: Settings },
              ].map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`flex min-h-16 min-w-16 flex-col items-center justify-center gap-1 text-[11px] font-medium ${isActive(href) ? "text-primary" : "text-muted-foreground"}`}><Icon className="h-5 w-5" /><span>{label}</span></Link>)}
            </nav>
          </div>
        </div>
      </div>
    </header>
  )
}
