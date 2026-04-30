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
  Building2, X, FileText, Receipt,
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
  { label: "Quotes",             href: "/quotes",             icon: FileText },
  { label: "Invoices",          href: "/invoices",           icon: Receipt },
  { label: "Reports",           href: "/reports",            icon: BarChart3 },
  { label: "AI Insights",       href: "/insights",           icon: Sparkles, highlight: true, requirePerm: "canViewInsights" },
  { label: "Customer Portal",   href: "/portal",             icon: Globe, requirePerm: "canAccessPortal" },
]

const PLAN_META: Record<string, { label: string; color: string }> = {
  starter:    { label: "Starter",    color: "#f59e0b" },
  growth:     { label: "Growth",     color: "#3b82f6" },
  enterprise: { label: "Enterprise", color: "#8b5cf6" },
}

// Mobile drawer open state — consumed by AppTopbar hamburger button
export const SidebarContext = React.createContext<{
  mobileOpen: boolean
  setMobileOpen: (v: boolean) => void
}>({ mobileOpen: false, setMobileOpen: () => {} })

// Inner sidebar body — shared between desktop and mobile drawer
function SidebarBody({
  collapsed,
  setCollapsed,
  isMobile,
}: {
  collapsed: boolean
  setCollapsed: (v: boolean) => void
  isMobile?: boolean
}) {
  const pathname = usePathname()
  const { workspace, dispatch, can } = useTenant()
  const [wsMenuOpen, setWsMenuOpen] = useState(false)
  const planMeta = PLAN_META[workspace.planId] ?? PLAN_META["growth"]

  const visibleNav = NAV_ITEMS.filter((item) => {
    if (!item.requirePerm) return true
    return can(item.requirePerm)
  })

  // In mobile mode always show expanded; desktop respects collapsed state
  const isCollapsed = isMobile ? false : collapsed

  return (
    <>
      {/* ── Logo hero ─────────────────────────────────────────── */}
      <div className={cn(
        "flex items-center justify-center border-b border-sidebar-border shrink-0",
        isCollapsed ? "px-2 py-5" : "px-4 py-4"
      )}>
        {isCollapsed ? (
          <div className="w-9 h-9 flex items-center justify-center">
            <img
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Equipify-ai-logo-f7EFjaBUGomUmpbzcNVUhtvs7TEz7H.png"
              alt="Equipify.ai"
              className="w-9 h-9 object-contain select-none"
              style={{ objectPosition: "left center" }}
              draggable={false}
            />
          </div>
        ) : (
          <img
            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Equipify-ai-logo-f7EFjaBUGomUmpbzcNVUhtvs7TEz7H.png"
            alt="Equipify.ai"
            className="h-9 w-auto object-contain select-none mx-auto"
            draggable={false}
          />
        )}
      </div>

      {/* ── Workspace selector ────────────────────────────────── */}
      <div className="relative px-3 py-3 border-b border-sidebar-border shrink-0">
        <button
          onClick={() => setWsMenuOpen((v) => !v)}
          className={cn(
            "w-full flex items-center gap-3 rounded-xl border border-sidebar-border bg-sidebar-accent/30 transition-all hover:border-primary/40 hover:bg-sidebar-accent/50",
            isCollapsed
              ? "justify-center p-2 border-transparent bg-transparent hover:bg-sidebar-accent/50"
              : "px-3.5 py-3"
          )}
        >
          {workspace.logoUrl ? (
            <img src={workspace.logoUrl} alt="" className="w-8 h-8 rounded-lg object-contain bg-white border border-sidebar-border shrink-0" />
          ) : (
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0 uppercase"
              style={{ background: workspace.primaryColor }}
              suppressHydrationWarning
            >
              {workspace.name[0]}
            </div>
          )}
          {!isCollapsed && (
            <>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-semibold text-sidebar-foreground truncate leading-tight">{workspace.name}</p>
                <span className="text-[11px] font-semibold" style={{ color: planMeta.color }}>{planMeta.label}</span>
              </div>
              <ChevronDown size={14} className={cn("text-sidebar-foreground/40 shrink-0 transition-transform duration-150", wsMenuOpen && "rotate-180")} />
            </>
          )}
        </button>

        {wsMenuOpen && !isCollapsed && (
          <div className="absolute top-full left-3 right-3 z-50 mt-1 bg-sidebar border border-sidebar-border rounded-xl shadow-xl overflow-hidden">
            <p className="px-3.5 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">Switch workspace</p>
            {MOCK_WORKSPACES.map((ws) => (
              <button key={ws.id} onClick={() => { dispatch({ type: "SWITCH_WORKSPACE", payload: ws.id }); setWsMenuOpen(false) }}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-sidebar-accent/50 transition-colors">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[11px] font-bold shrink-0" style={{ background: ws.primaryColor }}>{ws.name[0]}</div>
                <span className="text-sm text-sidebar-foreground truncate flex-1 text-left">{ws.name}</span>
                {ws.id === workspace.id && <Check size={13} className="text-primary shrink-0" />}
              </button>
            ))}
            <div className="border-t border-sidebar-border px-3.5 py-2.5">
              <Link href="/onboarding" onClick={() => setWsMenuOpen(false)} className="flex items-center gap-1.5 text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors">
                <Building2 size={13} /> Create new workspace
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* ── Navigation ────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
        {visibleNav.map(({ label, href, icon: Icon, highlight }) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(href))
          return (
            <Link key={href} href={href} title={isCollapsed ? label : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg text-sm transition-all duration-100 group relative",
                isCollapsed ? "justify-center h-11 w-11 mx-auto" : "h-11 px-3",
                active
                  ? "bg-primary text-white font-medium shadow-[0_1px_4px_rgba(0,0,0,0.18)]"
                  : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              )}
            >
              {active && !isCollapsed && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-white/60" />
              )}
              <Icon className={cn(
                "w-[18px] h-[18px] shrink-0 transition-all duration-100",
                active ? "text-white" : "text-sidebar-foreground/45 group-hover:text-sidebar-foreground"
              )} />
              {!isCollapsed && (
                <>
                  <span className="truncate flex-1 font-medium">{label}</span>
                  {highlight && !active && (
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary">AI</span>
                  )}
                </>
              )}
            </Link>
          )
        })}
      </nav>

      {/* ── Footer ────────────────────────────────────────────── */}
      <div className="border-t border-sidebar-border shrink-0">
        {!isCollapsed && (
          <div className="px-4 py-3 flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: "var(--status-success)" }} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-sidebar-foreground/50 leading-tight truncate">Workspace Active</p>
              <p className="text-[11px] text-sidebar-foreground/30 leading-tight mt-0.5">Version 1.0</p>
            </div>
          </div>
        )}
        {/* Only show collapse toggle on desktop */}
        {!isMobile && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              "w-full flex items-center gap-2 px-4 py-3 text-xs text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent/30 transition-colors",
              !isCollapsed && "border-t border-sidebar-border",
              isCollapsed && "justify-center"
            )}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <ChevronLeft className={cn("w-4 h-4 shrink-0 transition-transform", isCollapsed && "rotate-180")} />
            {!isCollapsed && <span className="font-medium">Collapse</span>}
          </button>
        )}
      </div>
    </>
  )
}

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const { mobileOpen, setMobileOpen } = React.useContext(SidebarContext)
  const pathname = usePathname()

  // Close mobile drawer on route change
  React.useEffect(() => { setMobileOpen(false) }, [pathname, setMobileOpen])

  return (
    <>
      {/* ── Desktop sidebar (hidden on mobile) ────────────────── */}
      <aside className={cn(
        "hidden md:flex flex-col h-full border-r border-sidebar-border bg-sidebar transition-all duration-200 shrink-0",
        collapsed ? "w-14" : "w-[248px]"
      )}>
        <SidebarBody collapsed={collapsed} setCollapsed={setCollapsed} />
      </aside>

      {/* ── Mobile overlay drawer ──────────────────────────────── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          {/* Drawer panel */}
          <aside className="absolute inset-y-0 left-0 flex flex-col w-64 bg-sidebar border-r border-sidebar-border shadow-2xl">
            {/* Close button */}
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-3 right-3 z-10 flex items-center justify-center w-7 h-7 rounded-md text-sidebar-foreground/50 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
              aria-label="Close menu"
            >
              <X className="w-4 h-4" />
            </button>
            <SidebarBody collapsed={false} setCollapsed={setCollapsed} isMobile />
          </aside>
        </div>
      )}
    </>
  )
}
