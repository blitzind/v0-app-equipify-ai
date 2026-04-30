"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Building2, Users, CreditCard, Shield } from "lucide-react"

const TABS = [
  { label: "Workspace",    href: "/settings/workspace", icon: Building2 },
  { label: "Team",         href: "/settings/team",      icon: Users },
  { label: "Billing",      href: "/settings/billing",   icon: CreditCard },
  { label: "Permissions",  href: "/settings/permissions", icon: Shield },
]

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your workspace, team, billing, and permissions.</p>
      </div>
      <nav className="flex gap-1 mb-8 border-b border-border">
        {TABS.map(({ label, href, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link key={href} href={href}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors
                ${active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"}`}>
              <Icon size={14} />
              {label}
            </Link>
          )
        })}
      </nav>
      {children}
    </div>
  )
}
