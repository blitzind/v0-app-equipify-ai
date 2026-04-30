"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Users,
  Wrench,
  ClipboardList,
  CalendarClock,
  ShieldCheck,
  HardHat,
  BarChart3,
  Globe,
  CreditCard,
  Settings,
  ChevronLeft,
  Zap,
} from "lucide-react"

const navItems = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Customers", href: "/customers", icon: Users },
  { label: "Equipment", href: "/equipment", icon: Wrench },
  { label: "Work Orders", href: "/work-orders", icon: ClipboardList },
  { label: "Service Schedule", href: "/service-schedule", icon: CalendarClock },
  { label: "Maintenance Plans", href: "/maintenance-plans", icon: ShieldCheck },
  { label: "Technicians", href: "/technicians", icon: HardHat },
  { label: "Reports", href: "/reports", icon: BarChart3 },
  { label: "Customer Portal", href: "/customer-portal", icon: Globe },
  { label: "Billing", href: "/billing", icon: CreditCard },
  { label: "Settings", href: "/settings", icon: Settings },
]

export function AppSidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={cn(
        "flex flex-col bg-sidebar text-sidebar-foreground transition-all duration-300 ease-in-out shrink-0",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo */}
      <div className={cn("flex items-center h-16 px-4 border-b border-sidebar-border", collapsed ? "justify-center" : "gap-3")}>
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary shrink-0">
          <Zap className="w-4 h-4 text-primary-foreground" />
        </div>
        {!collapsed && (
          <span className="text-sm font-semibold tracking-tight text-white">
            Equipify<span className="text-primary">.ai</span>
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
        {navItems.map(({ label, href, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={cn(
                "flex items-center gap-3 px-2.5 py-2 rounded-md text-sm transition-colors group",
                active
                  ? "bg-sidebar-accent text-white font-medium"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-white",
                collapsed && "justify-center"
              )}
            >
              <Icon className={cn("w-4 h-4 shrink-0", active ? "text-primary" : "text-sidebar-foreground group-hover:text-primary")} />
              {!collapsed && <span className="truncate">{label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="p-3 border-t border-sidebar-border">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "flex items-center gap-2 w-full px-2.5 py-2 rounded-md text-xs text-sidebar-foreground hover:bg-sidebar-accent hover:text-white transition-colors",
            collapsed && "justify-center"
          )}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ChevronLeft className={cn("w-4 h-4 shrink-0 transition-transform", collapsed && "rotate-180")} />
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  )
}
