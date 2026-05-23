"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const LINKS = [
  { href: "/admin/growth/leads", label: "Inbox", match: (path: string) => path === "/admin/growth/leads" },
  {
    href: "/admin/growth/leads/queue",
    label: "Call Queue",
    match: (path: string) => path.startsWith("/admin/growth/leads/queue"),
  },
] as const

export function GrowthLeadsSubnav() {
  const pathname = usePathname()

  return (
    <nav className="flex flex-wrap gap-2">
      {LINKS.map((link) => {
        const active = link.match(pathname)
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-border bg-background text-muted-foreground hover:bg-muted/40 hover:text-foreground",
            )}
          >
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}
