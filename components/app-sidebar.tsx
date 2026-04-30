"use client"

import React, { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useTenant } from "@/lib/tenant-store"
import { MOCK_WORKSPACES } from "@/lib/tenant-data"
import {
  LayoutDashboard, Users, Wrench, ClipboardList, CalendarClock,
  ShieldCheck, HardHat, BarChart3, Globe,
  ChevronLeft, Sparkles, ChevronDown, Check,
  Building2,
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
]

const PLAN_META: Record<string, { label: string; color: string }> = {
  starter:    { label: "Starter",    color: "#f59e0b" },
  growth:     { label: "Growth",     color: "#3b82f6" },
  enterprise: { label: "Enterprise", color: "#8b5cf6" },
}

export function AppSidebar() {
  const pathname = usePathname()
  const { workspace, dispatch, can } = useTenant()
  const [collapsed, setCollapsed] = useState(false)
  const [wsMenuOpen, setWsMenuOpen] = useState(false)

  const planMeta = PLAN_META[workspace.planId] ?? PLAN_META["growth"]

  const visibleNav = NAV_ITEMS.filter((item) => {
    if (!item.requirePerm) return true
    return can(item.requirePerm)
  })

  return (
    <aside className={cn(
      "flex flex-col h-full border-r border-sidebar-border bg-sidebar transition-all duration-200 shrink-0",
      collapsed ? "w-14" : "w-56"
    )}>

      {/* ── Logo hero ─────────────────────────────────────────── */}
      <div className={cn(
        "flex items-center justify-center border-b border-sidebar-border shrink-0",
        collapsed ? "px-2 py-4" : "px-4 py-5"
      )}>
        {collapsed ? (
          /* Collapsed: icon-only — the stylised "E" mark from the logo */
          <div className="w-9 h-9 flex items-center justify-center">
            {/* SVG "E" bolt mark matching the blue/orange Equipify logo icon */}
            <svg viewBox="0 0 40 44" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
              <polygon points="6,0 36,0 28,14 16,14" fill="#3b82f6" />
              <polygon points="6,16 30,16 22,30 10,30" fill="#60a5fa" />
              <polygon points="6,32 34,32 26,44 4,44" fill="#f59e0b" />
            </svg>
          </div>
        ) : (
          /* Expanded: full wordmark using the provided logo image */
          <img
            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Equipifyai-logo-jQMbC4ulkrtsosGYjH8bqfcHgelhfK.png"
            alt="Equipify.ai"
            className="h-10 w-auto object-contain select-none"
            draggable={false}
          />
        )}
      </div>

      {/* ── Workspace selector card ────────────────────────────── */}
      <div className="relative px-2 py-2 border-b border-sidebar-border shrink-0">
        <button
          onClick={() => setWsMenuOpen((v) => !v)}
          className={cn(
            "w-full flex items-center gap-2.5 rounded-lg border border-sidebar-border bg-sidebar-accent/30 px-2.5 py-2 transition-all hover:border-primary/40 hover:bg-sidebar-accent/50",
            collapsed && "justify-center px-0 border-transparent bg-transparent hover:bg-sidebar-accent/50"
          )}
        >
          {/* Workspace avatar */}
          {workspace.logoUrl ? (
            <img
              src={workspace.logoUrl}
              alt=""
              className="w-7 h-7 rounded-md object-contain bg-white border border-sidebar-border shrink-0"
            />
          ) : (
            <div
              className="w-7 h-7 rounded-md flex items-center justify-center text-white text-xs font-bold shrink-0 uppercase"
              style={{ background: workspace.primaryColor }}
              suppressHydrationWarning
            >
              {workspace.name[0]}
            </div>
          )}

          {!collapsed && (
            <>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-xs font-semibold text-sidebar-foreground truncate leading-tight">
                  {workspace.name}
                </p>
                <span
                  className="text-[10px] font-semibold"
                  style={{ color: planMeta.color }}
                >
                  {planMeta.label}
                </span>
              </div>
              <ChevronDown
                size={13}
                className={cn(
                  "text-sidebar-foreground/40 shrink-0 transition-transform duration-150",
                  wsMenuOpen && "rotate-180"
                )}
              />
            </>
          )}
        </button>

        {/* Workspace switcher dropdown */}
        {wsMenuOpen && !collapsed && (
          <div className="absolute top-full left-2 right-2 z-50 mt-1 bg-sidebar border border-sidebar-border rounded-lg shadow-xl overflow-hidden">
            <p className="px-3 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
              Switch workspace
            </p>
            {MOCK_WORKSPACES.map((ws) => (
              <button
                key={ws.id}
                onClick={() => { dispatch({ type: "SWITCH_WORKSPACE", payload: ws.id }); setWsMenuOpen(false) }}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-sidebar-accent/50 transition-colors"
              >
                <div
                  className="w-6 h-6 rounded-md flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                  style={{ background: ws.primaryColor }}
                >
                  {ws.name[0]}
                </div>
                <span className="text-xs text-sidebar-foreground truncate flex-1 text-left">{ws.name}</span>
                {ws.id === workspace.id && <Check size={12} className="text-primary shrink-0" />}
              </button>
            ))}
            <div className="border-t border-sidebar-border px-3 py-2">
              <Link
                href="/onboarding"
                onClick={() => setWsMenuOpen(false)}
                className="flex items-center gap-1.5 text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors"
              >
                <Building2 size={12} /> Create new workspace
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* ── Navigation ────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {visibleNav.map(({ label, href, icon: Icon, highlight }) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={cn(
                "flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-colors group",
                active
                  ? "bg-primary text-white font-medium shadow-sm"
                  : highlight
                    ? "text-[var(--ai-purple)] hover:bg-sidebar-accent/70 hover:text-white"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/70 hover:text-white",
                collapsed && "justify-center"
              )}
            >
              <Icon className={cn(
                "w-4 h-4 shrink-0 transition-colors",
                active
                  ? "text-white"
                  : highlight
                    ? "text-[var(--ai-purple)] group-hover:text-white"
                    : "text-sidebar-foreground/50 group-hover:text-white"
              )} />
              {!collapsed && (
                <>
                  <span className="truncate flex-1">{label}</span>
                  {highlight && !active && (
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--ai-purple)]/15 text-[var(--ai-purple)]">
                      AI
                    </span>
                  )}
                </>
              )}
            </Link>
          )
        })}
      </nav>

      {/* ── Footer ────────────────────────────────────────────── */}
      <div className="border-t border-sidebar-border shrink-0">
        {!collapsed && (
          <div className="px-3 py-2.5 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "var(--status-success)" }} />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium text-sidebar-foreground/50 leading-tight truncate">
                Workspace Active
              </p>
              <p className="text-[10px] text-sidebar-foreground/30 leading-tight">v1.0</p>
            </div>
          </div>
        )}
        <button
          onClick={() => setCollapsed((v) => !v)}
          className={cn(
            "w-full flex items-center gap-2 px-3 py-2.5 text-xs text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent/30 transition-colors",
            !collapsed && "border-t border-sidebar-border",
            collapsed && "justify-center"
          )}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ChevronLeft className={cn("w-3.5 h-3.5 shrink-0 transition-transform", collapsed && "rotate-180")} />
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  )
}
