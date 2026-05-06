"use client"

import React, { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useTenant } from "@/lib/tenant-store"
import { planBadgeFromWorkspace } from "@/lib/plan-display"
import { useActiveOrganization } from "@/lib/active-organization-context"
import {
  LayoutDashboard, Users, Wrench, ClipboardList, CalendarClock, CalendarRange,
  HardHat, BarChart3,
  ChevronLeft, Sparkles, ChevronDown, Check,
  Building2, X, FileText, Receipt, ShoppingCart, Store, FileBadge2, Package,
} from "lucide-react"
import { BrandLogo, BrandMark } from "@/components/brand-logo"
import { MaintenancePlansLucideIcon } from "@/lib/navigation/module-icons"
import {
  NAV_ICON_ACTIVE_SIDEBAR,
  NAV_ICON_INACTIVE_SIDEBAR,
  NAV_PRIMARY_ROW_MOTION,
  NAV_ROW_ACTIVE_SIDEBAR,
  NAV_ROW_INACTIVE_HOVER_SIDEBAR,
} from "@/lib/navigation-chrome"

type NavItem = {
  label: string
  href: string
  icon: React.ElementType
  highlight?: boolean
  requirePerm?: "canViewInsights" | "canAccessPortal" | "canViewBilling"
}

type NavGroup = {
  label: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Operations",
    items: [
      { label: "Dashboard",         href: "/",                  icon: LayoutDashboard },
      { label: "Customers",         href: "/customers",         icon: Users },
      { label: "Equipment",         href: "/equipment",         icon: Wrench },
      { label: "Work Orders",       href: "/work-orders",       icon: ClipboardList },
      { label: "Dispatch Board",    href: "/dispatch",          icon: CalendarRange },
      { label: "Service Schedule",  href: "/service-schedule",  icon: CalendarClock },
      { label: "Maintenance Plans", href: "/maintenance-plans", icon: MaintenancePlansLucideIcon },
      { label: "Certificates", href: "/calibration-templates", icon: FileBadge2 },
      { label: "Technicians",       href: "/technicians",       icon: HardHat },
    ],
  },
  {
    label: "Sales & Finance",
    items: [
      { label: "Quotes",           href: "/quotes",           icon: FileText },
      { label: "Invoices",         href: "/invoices",         icon: Receipt },
      { label: "Purchase Orders",  href: "/purchase-orders",  icon: ShoppingCart },
      { label: "Vendors",          href: "/vendors",          icon: Store },
      { label: "Catalog",          href: "/catalog",          icon: Package },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { label: "AI Insights", href: "/insights", icon: Sparkles, highlight: true, requirePerm: "canViewInsights" },
      { label: "Reports",     href: "/reports",  icon: BarChart3 },
    ],
  },
]

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
  const { workspace, can } = useTenant()
  const { organizations, organizationId, switchOrganization, status: orgStatus, switching } =
    useActiveOrganization()
  const [wsMenuOpen, setWsMenuOpen] = useState(false)
  const planMeta = planBadgeFromWorkspace(workspace)
  const orgPickerLoading = orgStatus === "loading" || switching
  const showOrgSwitcher = organizations.length > 1

  function toggleWorkspaceMenu() {
    if (!showOrgSwitcher) return
    setWsMenuOpen((v) => !v)
  }

  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.requirePerm || can(item.requirePerm)),
  })).filter((group) => group.items.length > 0)

  // In mobile mode always show expanded; desktop respects collapsed state
  const isCollapsed = isMobile ? false : collapsed

  return (
    <>
      {/* ── Logo hero (full wordmark expanded · square mark collapsed) ─ */}
      <div
        className={cn(
          "relative grid min-h-[52px] w-full shrink-0 place-items-center border-b border-sidebar-border [grid-template-areas:'stack'] px-3",
          isCollapsed ? "py-2" : "py-3.5"
        )}
      >
        <Link
          href="/"
          className="relative grid min-h-[2.5rem] w-full place-items-center [grid-template-areas:'stack'] rounded-md outline-none ring-sidebar-ring focus-visible:ring-2"
          aria-label="Equipify — Home"
        >
          {/* Expanded: full logo (also mobile drawer — always expanded) */}
          <span
            className={cn(
              "[grid-area:stack] flex w-full max-w-full items-center justify-center px-0.5 transition-opacity duration-200 ease-out motion-reduce:transition-none",
              isCollapsed ? "pointer-events-none opacity-0" : "opacity-100"
            )}
            aria-hidden={isCollapsed}
          >
            <BrandLogo
              priority
              sizes="(min-width: 768px) 198px, 182px"
              className="min-h-0 min-w-0 max-h-[calc(2.75rem-10px*280/1024)] w-full max-w-[calc(100%-10px)] select-none object-contain object-center sm:max-h-[calc(3rem-10px*280/1024)]"
            />
          </span>
          {/* Collapsed desktop only: icon mark */}
          <span
            className={cn(
              "[grid-area:stack] flex items-center justify-center transition-opacity duration-200 ease-out motion-reduce:transition-none",
              isCollapsed ? "opacity-100" : "pointer-events-none opacity-0"
            )}
            aria-hidden={!isCollapsed}
          >
            <BrandMark
              priority
              sizes="40px"
              className="h-10 w-10 max-h-10 max-w-10 select-none"
            />
          </span>
        </Link>
      </div>

      {/* ── Workspace selector ────────────────────────────────── */}
      <div className="relative px-3 py-3 border-b border-sidebar-border shrink-0">
        <button
          type="button"
          onClick={toggleWorkspaceMenu}
          aria-expanded={showOrgSwitcher ? wsMenuOpen : undefined}
          aria-haspopup={showOrgSwitcher ? "menu" : undefined}
          className={cn(
            "w-full flex items-center gap-3 rounded-xl border border-sidebar-border bg-sidebar-accent/30 transition-all duration-150",
            showOrgSwitcher && "hover:border-primary/40 hover:bg-sidebar-accent/50",
            !showOrgSwitcher && "cursor-default",
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
              {showOrgSwitcher ? (
                <ChevronDown
                  size={14}
                  className={cn(
                    "text-sidebar-foreground/40 shrink-0 transition-transform duration-150",
                    wsMenuOpen && "rotate-180",
                  )}
                />
              ) : null}
            </>
          )}
        </button>

        {wsMenuOpen && showOrgSwitcher && !isCollapsed && (
          <div className="absolute top-full left-3 right-3 z-50 mt-1 bg-sidebar border border-sidebar-border rounded-xl shadow-xl overflow-hidden">
            <p className="px-3.5 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
              Your organizations
            </p>
            {organizations.length > 0 ? (
              organizations.map((org) => (
                <button
                  key={org.id}
                  type="button"
                  disabled={orgPickerLoading}
                  onClick={() => {
                    void (async () => {
                      await switchOrganization(org.id)
                      setWsMenuOpen(false)
                    })()
                  }}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-sidebar-accent/50 transition-colors disabled:opacity-50"
                >
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[11px] font-bold shrink-0 uppercase"
                    style={{ background: workspace.primaryColor }}
                  >
                    {org.name[0]}
                  </div>
                  <span className="text-sm text-sidebar-foreground truncate flex-1 text-left">{org.name}</span>
                  {org.id === organizationId ? <Check size={13} className="text-primary shrink-0" /> : null}
                </button>
              ))
            ) : (
              <p className="px-3.5 py-3 text-xs text-sidebar-foreground/55">No organizations available.</p>
            )}
            <div className="border-t border-sidebar-border px-3.5 py-2.5">
              <Link href="/onboarding" onClick={() => setWsMenuOpen(false)} className="flex items-center gap-1.5 text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors">
                <Building2 size={13} /> Create new workspace
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* ── Navigation ────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto py-2 px-3">
        {visibleGroups.map((group, gi) => (
          <div key={group.label} className={cn(gi > 0 && "mt-4")}>
            {/* Group label — hidden when collapsed */}
            {!isCollapsed && (
              <p className="px-3 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/35 select-none">
                {group.label}
              </p>
            )}
            {/* Collapsed: thin divider between groups instead of label */}
            {isCollapsed && gi > 0 && (
              <div className="my-2 mx-auto w-5 border-t border-sidebar-border" />
            )}
            <div className="space-y-0.5">
              {group.items.map(({ label, href, icon: Icon, highlight }) => {
                const active = pathname === href || (href !== "/" && pathname.startsWith(href))
                return (
                  <Link
                    key={href}
                    href={href}
                    title={isCollapsed ? label : undefined}
                    className={cn(
                      "flex items-center gap-3 group relative",
                      NAV_PRIMARY_ROW_MOTION,
                      isCollapsed ? "justify-center h-10 w-10 mx-auto" : "h-10 px-3",
                      active ? NAV_ROW_ACTIVE_SIDEBAR : NAV_ROW_INACTIVE_HOVER_SIDEBAR,
                    )}
                  >
                    {/* Left accent bar — active only, desktop only */}
                    {active && !isCollapsed && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-blue-400" />
                    )}
                    {/* Collapsed active: dot indicator at bottom */}
                    {active && isCollapsed && (
                      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-blue-400" />
                    )}
                    <Icon className={cn(
                      "w-[17px] h-[17px] shrink-0 transition-all duration-150",
                      active ? NAV_ICON_ACTIVE_SIDEBAR : NAV_ICON_INACTIVE_SIDEBAR,
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
            </div>
          </div>
        ))}
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
        "hidden md:flex flex-col h-full border-r border-sidebar-border bg-[#0F172A] transition-all duration-200 shrink-0",
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
          <aside className="absolute inset-y-0 left-0 flex flex-col w-64 bg-[#0F172A] border-r border-sidebar-border shadow-2xl">
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
