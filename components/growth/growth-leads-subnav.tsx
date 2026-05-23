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
  {
    href: "/admin/growth/imports",
    label: "Imports",
    match: (path: string) => path.startsWith("/admin/growth/imports"),
  },
  {
    href: "/admin/growth/engagement",
    label: "Engagement",
    match: (path: string) => path.startsWith("/admin/growth/engagement"),
  },
  {
    href: "/admin/growth/relationships",
    label: "Relationships",
    match: (path: string) => path.startsWith("/admin/growth/relationships"),
  },
  {
    href: "/admin/growth/opportunities",
    label: "Opportunities",
    match: (path: string) => path.startsWith("/admin/growth/opportunities"),
  },
  {
    href: "/admin/growth/revenue",
    label: "Revenue",
    match: (path: string) => path.startsWith("/admin/growth/revenue"),
  },
  {
    href: "/admin/growth/executive",
    label: "Executive",
    match: (path: string) => path.startsWith("/admin/growth/executive"),
  },
  {
    href: "/admin/growth/outreach",
    label: "Outreach",
    match: (path: string) => path.startsWith("/admin/growth/outreach"),
  },
  {
    href: "/admin/growth/providers",
    label: "Providers",
    match: (path: string) => path.startsWith("/admin/growth/providers"),
  },
  {
    href: "/admin/growth/settings",
    label: "Settings",
    match: (path: string) => path.startsWith("/admin/growth/settings"),
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
