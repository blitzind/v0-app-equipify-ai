"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  User, Building2, Users, CreditCard, Bell,
  Zap, Plug, Shield, Code2, ScrollText, Wrench,
} from "lucide-react"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { label: "General",         href: "/settings/general",         icon: User },
  { label: "Workspace",       href: "/settings/workspace",       icon: Building2 },
  { label: "Team",            href: "/settings/team",            icon: Users },
  { label: "Billing",         href: "/settings/billing",         icon: CreditCard },
  { label: "Notifications",   href: "/settings/notifications",   icon: Bell },
  { label: "Automations",     href: "/settings/automations",     icon: Zap },
  { label: "Integrations",    href: "/settings/integrations",    icon: Plug },
  { label: "Security",        href: "/settings/security",        icon: Shield },
  { label: "API / Developers",href: "/settings/api",             icon: Code2 },
  { label: "Audit Log",       href: "/settings/audit-log",       icon: ScrollText },
  { label: "Equipment Types", href: "/settings/equipment-types", icon: Wrench },
]

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div className="border-b border-border pb-5">
        <h1 className="text-xl font-semibold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage your workspace, account, and platform configuration.
        </p>
      </div>

      <div className="flex gap-8 items-start">
        {/* Left sidebar nav */}
        <nav className="w-48 shrink-0 flex flex-col gap-0.5 sticky top-4" aria-label="Settings navigation">
          {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/")
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors",
                  active
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                <Icon size={15} className={active ? "text-primary" : "text-muted-foreground"} />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Content area */}
        <div className="flex-1 min-w-0">
          {children}
        </div>
      </div>
    </div>
  )
}
