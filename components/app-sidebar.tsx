"use client"

import React, { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useTenant } from "@/lib/tenant-store"
import { planBadgeFromWorkspace } from "@/lib/plan-display"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { useOrgPermissions } from "@/lib/org-permissions-context"
import { getOrgPermissionsForRole, type OrgMemberRole, type OrgPermissions } from "@/lib/permissions/model"
import {
  LayoutDashboard, Users, Wrench, ClipboardList, CalendarClock, CalendarRange,
  HardHat, BarChart3,
  ChevronLeft, Sparkles, ChevronDown, Check, Bot,
  Building2, X, FileText, Receipt, ShoppingCart, Store, FileBadge2, Package,
  Bell,
  Warehouse,
  UserPlus,
  Settings,
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
  /** href is empty string for placeholder/coming-soon items (renders disabled). */
  href: string
  icon: React.ElementType
  highlight?: boolean
  /** User needs at least one of these permissions (OR). Omit for routes available to all members. */
  anyOf?: (keyof OrgPermissions)[]
  /** Renders the row in a disabled "coming soon" style. */
  comingSoon?: boolean
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
      {
        label: "Inventory",
        href: "/inventory",
        icon: Warehouse,
        anyOf: ["canManageInventory", "canConsumePartsOnWorkOrders"],
      },
      { label: "Catalog", href: "/catalog", icon: Package, anyOf: ["canViewBilling"] },
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
      { label: "Purchase Orders", href: "/purchase-orders", icon: ShoppingCart, anyOf: ["canViewBilling"] },
      { label: "Vendors", href: "/vendors", icon: Store, anyOf: ["canViewBilling"] },
    ],
  },
  {
    id: "growth",
    label: "Automation & Intelligence",
    items: [
      {
        label: "Insights",
        href: "/insights",
        icon: Sparkles,
        highlight: true,
        anyOf: ["canViewInsights"],
      },
      {
        label: "AI Operations",
        href: "/ai-ops",
        icon: Bot,
        highlight: true,
        anyOf: ["canViewInsights"],
      },
      {
        label: "Communications",
        href: "/communications",
        icon: Bell,
        anyOf: ["canViewCommunications"],
      },
      {
        label: "AI Assistants",
        href: "/ai-assistants",
        icon: Bot,
        highlight: true,
        anyOf: ["canViewInsights"],
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
      { label: "Settings", href: "/settings/workspace", icon: Settings },
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

function isPrivilegedNavRole(role: OrgMemberRole | null): role is "owner" | "admin" | "manager" {
  return role === "owner" || role === "admin" || role === "manager"
}

function resolveNavPermissions(args: {
  role: OrgMemberRole | null
  status: "loading" | "ready" | "no_org"
  permissions: OrgPermissions
}): OrgPermissions {
  // Navigation should not let a commercial profile overlay accidentally hide
  // the owner/admin/manager workspace. Page/API permission checks still use the
  // effective capability set as the source of truth for mutations.
  if (isPrivilegedNavRole(args.role)) {
    return getOrgPermissionsForRole(args.role)
  }

  // While membership permissions are resolving, keep the shell useful instead
  // of rendering an almost-empty sidebar from the deny-all fallback.
  if (args.status !== "ready") {
    return getOrgPermissionsForRole("owner")
  }

  return args.permissions
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
function isItemActive(pathname: string, href: string): boolean {
  if (!href) return false
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(href + "/") || pathname.startsWith(href + "?")
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
  const { permissions, role, status: permissionsStatus } = useOrgPermissions()
  const { organizations, organizationId, switchOrganization, status: orgStatus, switching } =
    useActiveOrganization()
  const [wsMenuOpen, setWsMenuOpen] = useState(false)
  const planMeta = planBadgeFromWorkspace(workspace)
  const orgPickerLoading = orgStatus === "loading" || switching
  const showOrgSwitcher = organizations.length > 1

  useEffect(() => {
    debugNavResolution({
      event: "Sidebar mounted",
      role,
      permissionsStatus,
      organizationStatus: orgStatus,
      organizationId: organizationId ?? null,
    })
  }, [role, permissionsStatus, orgStatus, organizationId])

  function toggleWorkspaceMenu() {
    if (!showOrgSwitcher) return
    setWsMenuOpen((v) => !v)
  }

  const visibleGroups = useMemo(
    () => {
      const navPermissions = resolveNavPermissions({
        role,
        status: permissionsStatus,
        permissions,
      })
      debugNavResolution({
        event: "Nav items before filter",
        groupCount: NAV_GROUPS.length,
        itemCount: NAV_GROUPS.reduce((sum, group) => sum + group.items.length, 0),
        role,
        permissionsStatus,
        organizationStatus: orgStatus,
      })
      const groups = NAV_GROUPS.map((group) => ({
        ...group,
        items: group.items.filter((item) => navItemAllowed(item, navPermissions)),
      })).filter((group) => group.items.length > 0)
      debugNavResolution({
        event: "Nav items after filter",
        visibleGroups: groups.map((group) => ({ id: group.id, itemCount: group.items.length })),
      })
      return groups.length > 0 ? groups : FALLBACK_NAV_GROUPS
    },
    [permissions, role, permissionsStatus, orgStatus],
  )

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
        const owns = group.items.some((item) => isItemActive(pathname, item.href))
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

      {/* ── Workspace selector ──────────────────────────────────
          Collapsed rail (`w-14`) demands a square avatar slot, so we
          drop the default `w-full` button and switch to an explicit
          `h-10 w-10` square that centers cleanly. The avatar itself is
          locked to a square via `aspect-square` plus explicit min/max
          sizes so neither flex-shrink nor intrinsic-image sizing can
          deform the logo into a pill. */}
      <div
        className={cn(
          "relative border-b border-sidebar-border shrink-0",
          isCollapsed ? "px-2 py-2" : "px-3 py-3",
        )}
      >
        <button
          type="button"
          onClick={toggleWorkspaceMenu}
          aria-expanded={showOrgSwitcher ? wsMenuOpen : undefined}
          aria-haspopup={showOrgSwitcher ? "menu" : undefined}
          className={cn(
            "flex items-center gap-3 rounded-xl border transition-all duration-150",
            showOrgSwitcher && "hover:border-primary/40 hover:bg-sidebar-accent/50",
            !showOrgSwitcher && "cursor-default",
            isCollapsed
              ? // 40x40 square button, fully centered in the rail.
                "mx-auto h-10 w-10 aspect-square shrink-0 grow-0 justify-center p-1 border-transparent bg-transparent hover:bg-sidebar-accent/50"
              : "w-full px-3.5 py-3 border-sidebar-border bg-sidebar-accent/30",
          )}
        >
          {workspace.logoUrl ? (
            <img
              src={workspace.logoUrl}
              alt=""
              className={cn(
                // Iron-clad square sizing — explicit width AND height,
                // aspect-ratio guard, and a hard min/max that overrides
                // any flex shrink behavior even at narrow rail widths.
                "block h-8 w-8 min-h-8 min-w-8 max-h-8 max-w-8 aspect-square",
                "shrink-0 grow-0 basis-8 select-none",
                "rounded-lg border border-sidebar-border bg-white object-contain",
              )}
            />
          ) : (
            <div
              className={cn(
                "flex h-8 w-8 min-h-8 min-w-8 max-h-8 max-w-8 aspect-square",
                "shrink-0 grow-0 basis-8 select-none items-center justify-center",
                "rounded-lg uppercase text-white text-sm font-bold",
              )}
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
                    "shrink-0 text-sidebar-foreground/40 transition-transform duration-150",
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
                    className={cn(
                      // Square org avatar in the switcher menu — same
                      // ironclad sizing as the sidebar header avatar so a
                      // long org name in a tight row never compresses it.
                      "flex h-7 w-7 min-h-7 min-w-7 max-h-7 max-w-7 aspect-square",
                      "shrink-0 grow-0 basis-7 items-center justify-center",
                      "rounded-lg uppercase text-white text-[11px] font-bold",
                    )}
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
        {visibleGroups.map((group, gi) => {
          const groupCollapsed = collapsedGroups.has(group.id)
          const groupHasActive = group.items.some((item) => isItemActive(pathname, item.href))
          return (
            <div key={group.id} className={cn(gi > 0 && (isCollapsed ? "mt-3" : "mt-3"))}>
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
                        className="w-1.5 h-1.5 rounded-full bg-blue-400"
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
                className="space-y-0.5"
              >
                {group.items.map(({ label, href, icon: Icon, highlight, comingSoon }) => {
                  const active = isItemActive(pathname, href)
                  if (comingSoon) {
                    return (
                      <div
                        key={`${group.id}:${label}`}
                        title={isCollapsed ? `${label} — coming soon` : undefined}
                        aria-disabled
                        className={cn(
                          "flex items-center gap-3 group relative cursor-not-allowed select-none",
                          isCollapsed ? "justify-center h-10 w-10 mx-auto" : "h-10 px-3",
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
                      <Icon
                        className={cn(
                          "w-[17px] h-[17px] shrink-0 transition-all duration-150",
                          active ? NAV_ICON_ACTIVE_SIDEBAR : NAV_ICON_INACTIVE_SIDEBAR,
                        )}
                      />
                      {!isCollapsed && (
                        <>
                          <span className="truncate flex-1 font-medium">{label}</span>
                          {highlight && !active && (
                            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                              AI
                            </span>
                          )}
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

const SIDEBAR_COLLAPSED_KEY = "equipify:nav:sidebar-collapsed/v1"

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
