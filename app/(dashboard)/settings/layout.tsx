"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  User, Building2, Users, CreditCard, Bell,
  Zap, Plug, Shield, Code2, ScrollText, Wrench, Lock, Globe, Database, Archive,
} from "lucide-react"
import {
  NAV_ICON_INACTIVE_CARD,
  NAV_PRIMARY_ROW_MOTION,
  NAV_ROW_INACTIVE_HOVER_CARD,
} from "@/lib/navigation-chrome"

const NAV_ITEMS = [
  { label: "General",         href: "/settings/general",         icon: User },
  { label: "Workspace",       href: "/settings/workspace",       icon: Building2 },
  { label: "Sample data",     href: "/settings/sample-data",    icon: Database },
  { label: "Team",            href: "/settings/team",            icon: Users },
  { label: "Permissions",     href: "/settings/permissions",     icon: Lock },
  { label: "Billing",         href: "/settings/billing",         icon: CreditCard },
  { label: "Notifications",   href: "/settings/notifications",   icon: Bell },
  { label: "Automations",     href: "/settings/automations",     icon: Zap },
  { label: "Customer Portal", href: "/settings/portal",          icon: Globe },
  { label: "Integrations",    href: "/settings/integrations",    icon: Plug },
  { label: "Security",        href: "/settings/security",        icon: Shield },
  { label: "API / Developers",href: "/settings/api",             icon: Code2 },
  { label: "Audit Log",       href: "/settings/audit-log",       icon: ScrollText },
  { label: "Archived",        href: "/settings/archived",        icon: Archive },
  { label: "Equipment Types", href: "/settings/equipment-types", icon: Wrench },
]

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="flex flex-col gap-0 md:gap-5">
      {/* Mobile: scrollable horizontal tab strip */}
      <nav
        className="md:hidden flex items-center gap-1 overflow-x-auto scrollbar-none border-b border-border bg-card px-3 py-2 -mx-4 sticky top-0 z-20"
        aria-label="Settings navigation"
      >
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/")
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group flex items-center gap-1.5 whitespace-nowrap px-3 py-2 rounded-lg text-sm font-medium shrink-0 min-h-[44px]",
                NAV_PRIMARY_ROW_MOTION,
                active
                  ? "bg-primary/10 text-primary"
                  : NAV_ROW_INACTIVE_HOVER_CARD,
              )}
            >
              <Icon size={14} className={active ? "text-primary" : NAV_ICON_INACTIVE_CARD} />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="flex gap-8 items-start mt-3 md:mt-0">
        {/* Desktop: left sidebar nav */}
        <nav className="hidden md:flex w-48 shrink-0 flex-col gap-0.5 sticky top-4" aria-label="Settings navigation">
          {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/")
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "group flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm",
                  NAV_PRIMARY_ROW_MOTION,
                  active
                    ? "bg-primary/10 text-primary font-medium"
                    : NAV_ROW_INACTIVE_HOVER_CARD,
                )}
              >
                <Icon size={15} className={active ? "text-primary" : NAV_ICON_INACTIVE_CARD} />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Content area */}
        <div className="flex-1 min-w-0 pb-24 md:pb-6">
          {children}
        </div>
      </div>
    </div>
  )
}
