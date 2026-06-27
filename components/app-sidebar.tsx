"use client"

import React, { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useTenant } from "@/lib/tenant-store"
import { planBadgeFromWorkspace } from "@/lib/plan-display"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { useOrgPermissions } from "@/lib/org-permissions-context"
import { useAdmin } from "@/lib/admin-store"
import { getOrgPermissionsForRole, type OrgMemberRole, type OrgPermissions } from "@/lib/permissions/model"
import {
  LayoutDashboard, Users, Wrench, ClipboardList, CalendarClock, CalendarRange,
  HardHat, BarChart3,
  ChevronLeft, Sparkles, ChevronDown, Bot, Brain,
  X, FileText, Receipt, ShoppingCart, Store, FileBadge2, Package, Landmark,
  Bell,
  Warehouse,
  UserPlus,
  ChartNoAxesCombined,
} from "lucide-react"
import { MaintenancePlansLucideIcon, MembershipsLucideIcon } from "@/lib/navigation/module-icons"
import {
  NAV_ICON_ACTIVE_SIDEBAR,
  NAV_ICON_INACTIVE_SIDEBAR,
  NAV_PRIMARY_ROW_MOTION,
  NAV_ROW_ACTIVE_SIDEBAR,
  NAV_ROW_INACTIVE_HOVER_SIDEBAR,
  NAV_SIDEBAR_ACTIVE_INDICATOR,
} from "@/lib/navigation-chrome"
import {
  WORKSPACE_SIDEBAR_COLLAPSED_STORAGE_KEY,
  WORKSPACE_SIDEBAR_SURFACE,
  WORKSPACE_SIDEBAR_WIDTH_COLLAPSED,
  WORKSPACE_SIDEBAR_WIDTH_EXPANDED,
} from "@/lib/workspace/workspace-shell-tokens"
import { AI_OS_SIDEBAR_WORKSPACE_INDICATOR_LABEL } from "@/lib/workspace/ai-os-workspace-branding"
import { WorkspaceShellBrand } from "@/components/workspace/workspace-shell-brand"
import {
  WorkspaceSidebarOrganizationCard,
} from "@/components/workspace/workspace-sidebar-organization-card"

type NavItem = {
  label: string
  /** href is empty string for placeholder/coming-soon items (renders disabled). */
  href: string
  icon: React.ElementType
  highlight?: boolean
  /** User needs at least one of these permissions (OR). Omit for routes available to all members. */
  anyOf?: (keyof OrgPermissions)[]
  /** Renders the row in a disabled "coming soon" style. */
  comingSoon?: boolean
  /**
   * `exact` = only this href (or same path + query) is active — child paths like
   * `/insights/financial-command-center` do not match `/insights` (avoids double-highlight).
   */
  activeMatch?: "exact" | "prefix"
}

type NavGroup = {
  label: string
  /** Stable id for collapse persistence (independent from the user-facing label). */
  id: string
  items: NavItem[]
}

/**
 * Final left navigation grouping (Operations / Assets / Contacts / Financial /
 * Growth / Reports). Routes are unchanged — only labels and grouping. See
 * docs/LEFT_NAV_REFACTOR.md for the canonical mapping.
 */
const NAV_GROUPS: NavGroup[] = [
  {
    id: "operations",
    label: "Operations",
    items: [
      { label: "Dashboard", href: "/", icon: LayoutDashboard },
      { label: "Today", href: "/technicians/today", icon: HardHat, anyOf: ["canUseTechnicianWorkspace"] },
      { label: "Dispatch", href: "/dispatch", icon: CalendarRange, anyOf: ["canManageDispatch"] },
      { label: "Schedule", href: "/service-schedule", icon: CalendarClock, anyOf: ["canViewDispatch"] },
      { label: "Work Orders", href: "/work-orders", icon: ClipboardList, anyOf: ["canViewAllWorkOrders", "canViewAssignedWorkOrdersOnly", "canEditWorkOrders"] },
      { label: "Maintenance", href: "/maintenance-plans", icon: MaintenancePlansLucideIcon, anyOf: ["canManageDispatch"] },
      { label: "Technicians", href: "/technicians", icon: HardHat, anyOf: ["canManageTechnicians"] },
    ],
  },
  {
    id: "assets",
    label: "Assets",
    items: [
      { label: "Equipment", href: "/equipment", icon: Wrench, anyOf: ["canViewAllWorkOrders", "canViewAssignedWorkOrdersOnly", "canEditWorkOrders"] },
      { label: "Catalog", href: "/catalog", icon: Package, anyOf: ["canViewBilling"] },
      {
        label: "Inventory",
        href: "/inventory",
        icon: Warehouse,
        anyOf: ["canManageInventory", "canConsumePartsOnWorkOrders"],
      },
      {
        label: "Certificates",
        href: "/calibration-templates",
        icon: FileBadge2,
        anyOf: ["canManageCertificateTemplates"],
      },
    ],
  },
  {
    id: "contacts",
    label: "Contacts",
    items: [
      { label: "Customers", href: "/customers", icon: Users, anyOf: ["canViewAllWorkOrders", "canViewBilling", "canManageProspects"] },
      // Leads + Follow-Up Phase 1: pipeline lives at /prospects. Read access
      // matches RLS (org membership); editing/converting requires
      // `canManageProspects`, but we surface the link to all members so
      // viewers/techs can see the pipeline read-only.
      { label: "Prospects", href: "/prospects", icon: UserPlus, anyOf: ["canManageProspects"] },
    ],
  },
  {
    id: "financial",
    label: "Financial",
    items: [
      { label: "Quotes", href: "/quotes", icon: FileText, anyOf: ["canViewQuotes", "canEditQuotes"] },
      { label: "Invoices", href: "/invoices", icon: Receipt, anyOf: ["canViewBilling", "canEditInvoices"] },
      {
        label: "BlitzPay",
        href: "/insights/financial-command-center",
        icon: Landmark,
        anyOf: ["canViewFinancialReports", "canViewFinancials"],
      },
      {
        label: "Memberships",
        href: "/memberships",
        icon: MembershipsLucideIcon,
        anyOf: ["canViewFinancialReports", "canViewFinancials"],
      },
      { label: "Purchase Orders", href: "/purchase-orders", icon: ShoppingCart, anyOf: ["canViewBilling"] },
      { label: "Vendors", href: "/vendors", icon: Store, anyOf: ["canViewBilling"] },
    ],
  },
  {
    id: "growth",
    label: "Automation & Intelligence",
    items: [
      {
        label: "AI Insights",
        href: "/insights",
        icon: ChartNoAxesCombined,
        highlight: true,
        anyOf: ["canViewInsights"],
        activeMatch: "exact",
      },
      {
        label: "AI Operations",
        href: "/ai-ops",
        icon: Brain,
        highlight: true,
        anyOf: ["canViewInsights"],
      },
      {
        label: "AI Assistants",
        href: "/ai-assistants",
        icon: Bot,
        highlight: true,
        anyOf: ["canViewInsights"],
      },
      {
        label: "AIden Actions",
        href: "/aiden/actions",
        icon: Sparkles,
        highlight: true,
        anyOf: ["canViewInsights"],
      },
      {
        label: "Communications",
        href: "/communications",
        icon: Bell,
        anyOf: ["canViewCommunications"],
      },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    items: [
      {
        label: "Operations",
        href: "/reports",
        icon: BarChart3,
        anyOf: ["canViewOperationalReports", "canViewFinancialReports"],
      },
    ],
  },
]

const FALLBACK_NAV_GROUPS: NavGroup[] = [
  {
    id: "fallback-core",
    label: "Navigation",
    items: [
      { label: "Dashboard", href: "/", icon: LayoutDashboard },
      { label: "Customers", href: "/customers", icon: Users },
      { label: "Equipment", href: "/equipment", icon: Wrench },
      { label: "Work Orders", href: "/work-orders", icon: ClipboardList },
      { label: "Service Schedule", href: "/service-schedule", icon: CalendarClock },
    ],
  },
]

function navItemAllowed(
  item: NavItem,
  perms: OrgPermissions | null | undefined,
): boolean {
  // Coming-soon placeholders always render so the user can see roadmap items.
  if (item.comingSoon) return true
  if (!item.anyOf?.length) return true
  if (!perms) return true
  try {
    return item.anyOf.some((k) => Boolean(perms[k]))
  } catch {
    return true
  }
}

function debugNavResolution(details: Record<string, unknown>) {
  if (process.env.NEXT_PUBLIC_DEBUG_NAV !== "true") return
  console.info("[equipify:nav]", details)
}

function shouldRenderNavDebugPanel(): boolean {
  return process.env.NEXT_PUBLIC_DEBUG_NAV === "true"
}

function resolveNavPermissions(args: {
  role: OrgMemberRole | null
  status: "loading" | "ready" | "no_org"
  platformAdmin: boolean
  impersonating: boolean
}): OrgPermissions {
  if (args.platformAdmin || args.impersonating) {
    return getOrgPermissionsForRole("owner")
  }

  if (args.status !== "ready") {
    return getOrgPermissionsForRole(null)
  }

  if (!args.role) {
    return getOrgPermissionsForRole(null)
  }

  return getOrgPermissionsForRole(args.role)
}

function enabledPermissionKeys(perms: OrgPermissions): string[] {
  return Object.entries(perms)
    .filter(([, value]) => Boolean(value))
    .map(([key]) => key)
    .sort()
}

// ─── Collapse persistence ────────────────────────────────────────────────────

const NAV_GROUP_STORAGE_KEY = "equipify:nav:groups:collapsed/v1"

function readCollapsedGroups(): Set<string> {
  if (typeof window === "undefined") return new Set()
  try {
    const raw = window.localStorage.getItem(NAV_GROUP_STORAGE_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    if (Array.isArray(parsed)) return new Set(parsed.filter((x): x is string => typeof x === "string"))
    return new Set()
  } catch {
    return new Set()
  }
}

function writeCollapsedGroups(set: Set<string>) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(NAV_GROUP_STORAGE_KEY, JSON.stringify(Array.from(set)))
  } catch {
    // localStorage may be unavailable (private mode); collapse state stays in memory.
  }
}

/** Active match — copies the rule used for individual rows so headers and rows agree. */
function isItemActive(pathname: string, href: string, item?: Pick<NavItem, "activeMatch">): boolean {
  if (!href) return false
  if (href === "/") return pathname === "/"
  if (item?.activeMatch === "exact") {
    return pathname === href || pathname.startsWith(href + "?")
  }
  return pathname === href || pathname.startsWith(href + "/") || pathname.startsWith(href + "?")
}

/** “AI” pill shared by Automation & Intelligence nav rows (AI Insights, AI Operations, AI Assistants, AIden Actions). */
function SidebarNavAiPill() {
  return (
    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary shrink-0">
      AI
    </span>
  )
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
  const { workspace } = useTenant()
  const { role, status: permissionsStatus } = useOrgPermissions()
  const { isPlatformAdmin, impersonation, sessionIdentityLoading } = useAdmin()
  const {
    organizations,
    organizationId,
    status: orgStatus,
    supportAccessActive,
  } = useActiveOrganization()
  const planMeta = planBadgeFromWorkspace(workspace)

  useEffect(() => {
    debugNavResolution({
      event: "Sidebar mounted",
      role,
      permissionsStatus,
      organizationStatus: orgStatus,
      organizationId: organizationId ?? null,
    })
  }, [role, permissionsStatus, orgStatus, organizationId])

  const navResolution = useMemo(
    () => {
      const navPermissions = resolveNavPermissions({
        role,
        status: permissionsStatus,
        platformAdmin: isPlatformAdmin,
        impersonating: impersonation.active || supportAccessActive,
      })
      debugNavResolution({
        event: "Nav items before filter",
        groupCount: NAV_GROUPS.length,
        itemCount: NAV_GROUPS.reduce((sum, group) => sum + group.items.length, 0),
        role,
        permissionsStatus,
        organizationStatus: orgStatus,
      })
      const filteredOut: Array<{ label: string; reason: string }> = []
      const groups = NAV_GROUPS.map((group) => {
        const items = group.items.filter((item) => {
          const allowed = navItemAllowed(item, navPermissions)
          if (!allowed) {
            filteredOut.push({
              label: `${group.label} / ${item.label}`,
              reason: item.anyOf?.length
                ? `missing any of: ${item.anyOf.join(", ")}`
                : "unknown filter",
            })
          }
          return allowed
        })
        return { ...group, items }
      }).filter((group) => group.items.length > 0)
      const visibleLabels = groups.flatMap((group) => group.items.map((item) => `${group.label} / ${item.label}`))
      debugNavResolution({
        event: "Nav items after filter",
        visibleGroups: groups.map((group) => ({ id: group.id, itemCount: group.items.length })),
        visibleLabels,
        filteredOut,
      })
      const debug = shouldRenderNavDebugPanel()
        ? {
          role,
          permissionsStatus,
          organizationStatus: orgStatus,
          organizationId: organizationId ?? null,
          organizationName: organizations.find((org) => org.id === organizationId)?.name ?? null,
          platformAdmin: isPlatformAdmin,
          impersonating: impersonation.active,
          supportAccessActive,
          enabledPermissions: enabledPermissionKeys(navPermissions),
          visibleLabels,
          filteredOut,
        }
        : null
      return {
        groups: groups.length > 0 ? groups : FALLBACK_NAV_GROUPS,
        debug,
      }
    },
    [
      role,
      permissionsStatus,
      orgStatus,
      organizationId,
      organizations,
      isPlatformAdmin,
      sessionIdentityLoading,
      impersonation.active,
      supportAccessActive,
    ],
  )

  const visibleGroups = navResolution.groups
  const navDebug = navResolution.debug

  // In mobile mode always show expanded; desktop respects collapsed state
  const isCollapsed = isMobile ? false : collapsed

  // ── Collapsible category groups ─────────────────────────────────────────
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set())
  useEffect(() => {
    setCollapsedGroups(readCollapsedGroups())
  }, [])

  useEffect(() => {
    setCollapsedGroups((prev) => {
      if (visibleGroups.length === 0) return prev
      const allVisibleGroupsCollapsed = visibleGroups.every((group) => prev.has(group.id))
      if (!allVisibleGroupsCollapsed) return prev
      const next = new Set<string>()
      writeCollapsedGroups(next)
      debugNavResolution({ event: "Expanded all nav groups because all visible groups were collapsed" })
      return next
    })
  }, [visibleGroups])

  // Auto-expand the group that owns the active route so the active row is
  // never hidden behind a collapsed header.
  useEffect(() => {
    setCollapsedGroups((prev) => {
      let mutated = false
      const next = new Set(prev)
      for (const group of visibleGroups) {
        if (!next.has(group.id)) continue
        const owns = group.items.some((item) => isItemActive(pathname, item.href, item))
        if (owns) {
          next.delete(group.id)
          mutated = true
        }
      }
      if (mutated) writeCollapsedGroups(next)
      return mutated ? next : prev
    })
  }, [pathname, visibleGroups])

  function toggleGroup(id: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      writeCollapsedGroups(next)
      return next
    })
  }

  return (
    <>
      {/* ── Logo hero (full wordmark expanded · square mark collapsed) ─ */}
      <WorkspaceShellBrand collapsed={isCollapsed} homeHref="/" />

      <WorkspaceSidebarOrganizationCard
        collapsed={isCollapsed}
        secondaryLabel={planMeta.label}
        secondaryLabelColor={planMeta.color}
        showSupportAccessBadge={supportAccessActive}
      />

      {/* ── Navigation ────────────────────────────────────────── */}
      <nav
        className={cn(
          "flex-1 overflow-y-auto py-2",
          isCollapsed ? "flex flex-col items-stretch px-0" : "px-3",
        )}
      >
        {shouldRenderNavDebugPanel() && navDebug ? (
          <div className="mb-3 rounded-md border border-amber-400/40 bg-amber-400/10 p-2 text-[10px] leading-relaxed text-amber-50">
            <p className="font-semibold">Nav Debug</p>
            <p>Org: {navDebug.organizationName ?? "unknown"} ({navDebug.organizationId ?? "none"})</p>
            <p>Role: {navDebug.role ?? "none"} · State: {navDebug.permissionsStatus}</p>
            <p>
              Platform admin: {String(navDebug.platformAdmin)} · Impersonating: {String(navDebug.impersonating)} ·
              Support access: {String(navDebug.supportAccessActive)}
            </p>
            <p>Visible: {navDebug.visibleLabels.join(", ") || "none"}</p>
            <details className="mt-1">
              <summary>Filtered out ({navDebug.filteredOut.length})</summary>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {navDebug.filteredOut.map((item) => (
                  <li key={item.label}>
                    {item.label}: {item.reason}
                  </li>
                ))}
              </ul>
            </details>
            <details className="mt-1">
              <summary>Enabled permissions ({navDebug.enabledPermissions.length})</summary>
              <p className="mt-1 break-words">{navDebug.enabledPermissions.join(", ") || "none"}</p>
            </details>
          </div>
        ) : null}
        {visibleGroups.map((group, gi) => {
          const groupCollapsed = collapsedGroups.has(group.id)
          const groupHasActive = group.items.some((item) => isItemActive(pathname, item.href, item))
          return (
            <div key={group.id} className={cn("w-full", gi > 0 && (isCollapsed ? "mt-3" : "mt-3"))}>
              {/* Collapsible category header — desktop only when sidebar is open */}
              {!isCollapsed && (
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  aria-expanded={!groupCollapsed}
                  aria-controls={`nav-group-${group.id}`}
                  className={cn(
                    "w-full flex items-center justify-between gap-2 px-3 pb-1 pt-0.5",
                    "text-[10px] font-semibold uppercase tracking-widest select-none",
                    "rounded-md text-sidebar-foreground/40 hover:text-sidebar-foreground/70 transition-colors",
                  )}
                >
                  <span className="flex items-center gap-1.5">
                    {group.label}
                    {groupCollapsed && groupHasActive && (
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: NAV_SIDEBAR_ACTIVE_INDICATOR }}
                        aria-label="Active route inside collapsed group"
                      />
                    )}
                  </span>
                  <ChevronDown
                    size={11}
                    className={cn(
                      "shrink-0 transition-transform duration-150",
                      groupCollapsed && "-rotate-90",
                    )}
                  />
                </button>
              )}
              {/* Collapsed: thin divider between groups instead of header */}
              {isCollapsed && gi > 0 && (
                <div className="my-2 mx-auto w-5 border-t border-sidebar-border" />
              )}
              <div
                id={`nav-group-${group.id}`}
                hidden={!isCollapsed && groupCollapsed}
                className={cn("space-y-0.5", isCollapsed && "flex flex-col items-stretch")}
              >
                {group.items.map(({ label, href, icon: Icon, highlight, comingSoon, activeMatch }) => {
                  const active = isItemActive(pathname, href, { activeMatch })
                  if (comingSoon) {
                    return (
                      <div
                        key={`${group.id}:${label}`}
                        title={isCollapsed ? `${label} — coming soon` : undefined}
                        aria-disabled
                        className={cn(
                          "flex items-center gap-3 group relative cursor-not-allowed select-none",
                          isCollapsed ? "h-10 w-full min-w-0 justify-center px-0" : "h-10 px-3",
                          NAV_ROW_INACTIVE_HOVER_SIDEBAR,
                          "opacity-55 hover:opacity-65",
                        )}
                      >
                        <Icon className={cn("w-[17px] h-[17px] shrink-0", NAV_ICON_INACTIVE_SIDEBAR)} />
                        {!isCollapsed && (
                          <>
                            <span className="truncate flex-1 font-medium">{label}</span>
                            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border border-sidebar-border text-sidebar-foreground/55">
                              Soon
                            </span>
                          </>
                        )}
                      </div>
                    )
                  }
                  return (
                    <Link
                      key={href}
                      href={href}
                      title={isCollapsed ? label : undefined}
                      className={cn(
                        "flex items-center gap-3 group relative",
                        NAV_PRIMARY_ROW_MOTION,
                        isCollapsed ? "h-10 w-full min-w-0 justify-center px-0" : "h-10 px-3",
                        active ? NAV_ROW_ACTIVE_SIDEBAR : NAV_ROW_INACTIVE_HOVER_SIDEBAR,
                      )}
                    >
                      {/* Left accent bar — active only, desktop only */}
                      {active && !isCollapsed && (
                        <span
                          className="absolute left-0 top-1/2 z-[1] -translate-y-1/2 w-[3px] h-5 rounded-r-full"
                          style={{ backgroundColor: NAV_SIDEBAR_ACTIVE_INDICATOR }}
                          aria-hidden
                        />
                      )}
                      {/* Collapsed active: accent dot (matches left-rail orange) */}
                      {active && isCollapsed && (
                        <span
                          className="absolute bottom-1 left-1/2 z-[1] -translate-x-1/2 w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: NAV_SIDEBAR_ACTIVE_INDICATOR }}
                          aria-hidden
                        />
                      )}
                      <Icon
                        className={cn(
                          "w-[17px] h-[17px] shrink-0 transition-all duration-150",
                          active ? NAV_ICON_ACTIVE_SIDEBAR : NAV_ICON_INACTIVE_SIDEBAR,
                        )}
                      />
                      {!isCollapsed && (
                        <>
                          <span className="truncate flex-1 font-medium">{label}</span>
                          {highlight && !active && <SidebarNavAiPill />}
                        </>
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>

      {/* ── Footer ────────────────────────────────────────────── */}
      <div className="border-t border-sidebar-border shrink-0">
        {!isCollapsed && (
          <div className="px-4 py-3 flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: "var(--status-success)" }} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-sidebar-foreground/50 leading-tight truncate">
                {AI_OS_SIDEBAR_WORKSPACE_INDICATOR_LABEL}
              </p>
              <p className="text-[11px] text-sidebar-foreground/30 leading-tight mt-0.5">Version 1.0</p>
            </div>
          </div>
        )}
        {/* Only show collapse toggle on desktop */}
        {!isMobile && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              "w-full flex items-center gap-2 py-3 text-xs text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent/30 transition-colors",
              isCollapsed ? "justify-center px-0" : "px-4",
              !isCollapsed && "border-t border-sidebar-border",
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

const SIDEBAR_COLLAPSED_KEY = WORKSPACE_SIDEBAR_COLLAPSED_STORAGE_KEY

export function AppSidebar() {
  const [collapsed, setCollapsedState] = useState(false)
  const { mobileOpen, setMobileOpen } = React.useContext(SidebarContext)
  const pathname = usePathname()

  // Restore desktop sidebar collapsed state (icon rail vs full sidebar).
  React.useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const raw = window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY)
      if (raw === "1") setCollapsedState(true)
    } catch {
      // ignore — fall back to default expanded.
    }
  }, [])

  const setCollapsed = React.useCallback((v: boolean) => {
    setCollapsedState(v)
    if (typeof window === "undefined") return
    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, v ? "1" : "0")
    } catch {
      // ignore
    }
  }, [])

  // Close mobile drawer on route change
  React.useEffect(() => { setMobileOpen(false) }, [pathname, setMobileOpen])

  return (
    <>
      {/* ── Desktop sidebar (hidden on mobile) ────────────────── */}
      <aside className={cn(
        "hidden md:flex",
        WORKSPACE_SIDEBAR_SURFACE,
        collapsed ? WORKSPACE_SIDEBAR_WIDTH_COLLAPSED : WORKSPACE_SIDEBAR_WIDTH_EXPANDED,
      )}>
        <SidebarBody collapsed={collapsed} setCollapsed={setCollapsed} />
      </aside>

      {/* ── Mobile overlay drawer ──────────────────────────────── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="presentation">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          {/* Drawer panel */}
          <aside
            id="mobile-sidebar-nav"
            role="navigation"
            aria-label="Primary navigation"
            className="absolute inset-y-0 left-0 flex flex-col w-64 max-w-[85vw] bg-[#0F172A] border-r border-sidebar-border shadow-2xl outline-none"
          >
            {/* Close button */}
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute top-3 right-3 z-10 flex items-center justify-center min-h-11 min-w-11 rounded-md text-sidebar-foreground/50 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors touch-manipulation"
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
