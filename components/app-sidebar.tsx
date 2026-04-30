"use client"

import React, { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useTenant } from "@/lib/tenant-store"
import { MOCK_WORKSPACES } from "@/lib/tenant-data"
import {
  LayoutDashboard, Users, Wrench, ClipboardList, CalendarClock,
  ShieldCheck, HardHat, BarChart3, Globe, CreditCard, Settings,
  ChevronLeft, Zap, Sparkles, ChevronDown, Check, LogOut,
  Building2, UserCircle,
} from "lucide-react"

const NAV_ITEMS: {
  label: string
  href: string
  icon: React.ElementType
  highlight?: boolean
  requirePerm?: "canViewInsights" | "canAccessPortal" | "canViewBilling"
}[] = [
  { label: "Dashboard",         href: "/",                   icon: LayoutDashboard },
  { label: "Customers",         href: "/customers",          icon: Users },
  { label: "Equipment",         href: "/equipment",          icon: Wrench },
  { label: "Work Orders",       href: "/work-orders",        icon: ClipboardList },
  { label: "Service Schedule",  href: "/service-schedule",   icon: CalendarClock },
  { label: "Maintenance Plans", href: "/maintenance-plans",  icon: ShieldCheck },
  { label: "Technicians",       href: "/technicians",        icon: HardHat },
  { label: "Reports",           href: "/reports",            icon: BarChart3 },
  { label: "AI Insights",       href: "/insights",           icon: Sparkles, highlight: true, requirePerm: "canViewInsights" },
  { label: "Customer Portal",   href: "/portal",             icon: Globe, requirePerm: "canAccessPortal" },
  { label: "Billing",           href: "/billing",            icon: CreditCard, requirePerm: "canViewBilling" },
  { label: "Settings",          href: "/settings/workspace", icon: Settings },
]

const PLAN_META = {
  starter:    { label: "Starter",    color: "#b45309", bg: "#fffbeb" },
  growth:     { label: "Growth",     color: "#1d4ed8", bg: "#eff6ff" },
  enterprise: { label: "Enterprise", color: "#6d28d9", bg: "#f5f3ff" },
}

export function AppSidebar() {
  const pathname = usePathname()
  const { workspace, currentUser, dispatch, can } = useTenant()
  const [collapsed, setCollapsed] = useState(false)
  const [wsMenuOpen, setWsMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const planMeta = PLAN_META[workspace.planId]
  const initials = currentUser.name.split(" ").map((n) => n[0]).join("").slice(0, 2)

  const visibleNav = NAV_ITEMS.filter((item) => {
    if (!item.requirePerm) return true
    return can(item.requirePerm)
  })

  return (
    <aside className={cn(
      "flex flex-col h-full border-r border-sidebar-border bg-sidebar transition-all duration-200 shrink-0",
      collapsed ? "w-14" : "w-56"
    )}>

      {/* Workspace switcher */}
      <div className="relative border-b border-sidebar-border">
        <button
          onClick={() => { setWsMenuOpen((v) => !v); setUserMenuOpen(false) }}
          className={cn(
            "w-full flex items-center gap-2.5 px-3 py-3 hover:bg-sidebar-accent/50 transition-colors",
            collapsed && "justify-center px-0"
          )}>
          {workspace.logoUrl ? (
            <img src={workspace.logoUrl} alt="" className="w-7 h-7 rounded-lg object-contain bg-white border border-sidebar-border shrink-0" />
          ) : (
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
              style={{ background: workspace.primaryColor }}>
              {workspace.name[0]}
            </div>
          )}
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-xs font-semibold text-sidebar-foreground truncate leading-tight">{workspace.name}</p>
                <span className="text-[10px] font-medium px-1.5 py-px rounded"
                  style={{ color: planMeta.color, background: planMeta.bg }}>
                  {planMeta.label}
                </span>
              </div>
              <ChevronDown size={12} className="text-sidebar-foreground/40 shrink-0" />
            </>
          )}
        </button>

        {wsMenuOpen && !collapsed && (
          <div className="absolute top-full left-0 right-0 z-50 bg-sidebar border-x border-b border-sidebar-border shadow-lg">
            <p className="px-3 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
              Switch workspace
            </p>
            {MOCK_WORKSPACES.map((ws) => (
              <button key={ws.id}
                onClick={() => { dispatch({ type: "SWITCH_WORKSPACE", payload: ws.id }); setWsMenuOpen(false) }}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-sidebar-accent/50 transition-colors">
                <div className="w-6 h-6 rounded-md flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                  style={{ background: ws.primaryColor }}>
                  {ws.name[0]}
                </div>
                <span className="text-xs text-sidebar-foreground truncate flex-1 text-left">{ws.name}</span>
                {ws.id === workspace.id && <Check size={12} className="text-sidebar-foreground/50 shrink-0" />}
              </button>
            ))}
            <div className="border-t border-sidebar-border px-3 py-2">
              <Link href="/onboarding" onClick={() => setWsMenuOpen(false)}
                className="flex items-center gap-1.5 text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors">
                <Building2 size={12} /> Create new workspace
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {visibleNav.map(({ label, href, icon: Icon, highlight }) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(href))
          return (
            <Link key={href} href={href} title={collapsed ? label : undefined}
              className={cn(
                "flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-colors group",
                active
                  ? "bg-sidebar-accent text-white font-medium"
                  : highlight
                    ? "text-blue-400 hover:bg-sidebar-accent hover:text-white"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-white",
                collapsed && "justify-center"
              )}>
              <Icon className={cn(
                "w-4 h-4 shrink-0",
                active ? "text-primary" : highlight ? "text-blue-400 group-hover:text-primary" : "text-sidebar-foreground/70 group-hover:text-primary"
              )} />
              {!collapsed && (
                <>
                  <span className="truncate flex-1">{label}</span>
                  {highlight && !active && (
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">
                      AI
                    </span>
                  )}
                </>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Bottom: collapse + user */}
      <div className="border-t border-sidebar-border">
        <button
          onClick={() => setCollapsed((v) => !v)}
          className={cn(
            "w-full flex items-center gap-2 px-3 py-2 text-xs text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent/30 transition-colors",
            collapsed && "justify-center"
          )}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          <ChevronLeft className={cn("w-3.5 h-3.5 shrink-0 transition-transform", collapsed && "rotate-180")} />
          {!collapsed && <span>Collapse</span>}
        </button>

        {/* User row */}
        <div className="relative border-t border-sidebar-border">
          <button
            onClick={() => { setUserMenuOpen((v) => !v); setWsMenuOpen(false) }}
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-sidebar-accent/50 transition-colors",
              collapsed && "justify-center px-0"
            )}>
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
              style={{ background: workspace.primaryColor }}>
              {initials}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0 text-left">
                <p className="text-xs font-medium text-sidebar-foreground truncate leading-tight">{currentUser.name}</p>
                <p className="text-[10px] text-sidebar-foreground/50 truncate">{currentUser.role}</p>
              </div>
            )}
          </button>

          {userMenuOpen && !collapsed && (
            <div className="absolute bottom-full left-0 right-0 z-50 bg-sidebar border border-sidebar-border shadow-lg rounded-t-lg overflow-hidden">
              <div className="px-3 py-2.5 border-b border-sidebar-border">
                <p className="text-xs font-medium text-sidebar-foreground">{currentUser.name}</p>
                <p className="text-[10px] text-sidebar-foreground/50">{currentUser.email}</p>
              </div>
              <Link href="/settings/workspace" onClick={() => setUserMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-xs text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors">
                <UserCircle size={12} /> Account settings
              </Link>
              <Link href="/settings/billing" onClick={() => setUserMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-xs text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors">
                <CreditCard size={12} /> Billing
              </Link>
              <div className="border-t border-sidebar-border">
                <Link href="/login" onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-sidebar-accent/50 transition-colors">
                  <LogOut size={12} /> Sign out
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
