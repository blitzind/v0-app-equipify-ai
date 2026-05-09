"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { useQuickAddDispatch } from "@/lib/quick-add-context"
import type { QuickAddAction } from "@/lib/quick-add-context"
import { useBillingAccess } from "@/lib/billing-access-context"
import { useOrgPermissions } from "@/lib/org-permissions-context"
import { getOrgPermissionsForRole, type OrgMemberRole, type OrgPermissions } from "@/lib/permissions/model"
import { blockCreateIfNotEligible } from "@/lib/billing/guard-toast"
import {
  LayoutDashboard, CalendarClock, Users, MoreHorizontal, Plus,
  Wrench, ClipboardList, FileText, Receipt, BarChart3, Sparkles,
  Settings, X, UserPlus, CalendarPlus, ClipboardPlus, FilePlus, ReceiptText, ShoppingCart, HardHat,
} from "lucide-react"
import { MaintenancePlansLucideIcon } from "@/lib/navigation/module-icons"

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ACCENT = "#f59f1c"

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/"
  return pathname.startsWith(href)
}

function allowed(perms: OrgPermissions | null | undefined, anyOf?: (keyof OrgPermissions)[]) {
  if (!anyOf?.length) return true
  if (!perms) return true
  try {
    return anyOf.some((key) => Boolean(perms[key]))
  } catch {
    return true
  }
}

function debugMobileNavResolution(details: Record<string, unknown>) {
  if (process.env.NEXT_PUBLIC_DEBUG_NAV !== "true") return
  console.info("[equipify:mobile-nav]", details)
}

function resolveMobileNavPermissions(args: {
  role: OrgMemberRole | null
  status: "loading" | "ready" | "no_org"
}): OrgPermissions {
  // Phase 20 retry: mobile navigation uses stable DB role defaults only.
  // Commercial profile overlays stay available for previews/API helpers, but
  // must not hide nav during loading or refresh.
  if (args.status !== "ready") {
    return getOrgPermissionsForRole("owner")
  }
  if (!args.role) {
    return getOrgPermissionsForRole("owner")
  }
  return getOrgPermissionsForRole(args.role)
}

// ─── BottomSheet ──────────────────────────────────────────────────────────────

function BottomSheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-[90] bg-black/40 transition-opacity duration-200 lg:hidden",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        )}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={cn(
          "fixed bottom-0 left-0 right-0 z-[91] lg:hidden",
          "bg-background rounded-t-2xl shadow-[0_-4px_24px_rgba(0,0,0,0.15)]",
          "transition-transform duration-300 ease-out",
          open ? "translate-y-0" : "translate-y-full",
        )}
        style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
      >
        {children}
      </div>
    </>
  )
}

// ─── QuickAddSheet ────────────────────────────────────────────────────────────

// Map each action to the page it lives on
const ACTION_ROUTES: Record<QuickAddAction, string> = {
  "new-customer":    "/customers",
  "new-equipment":   "/equipment",
  "new-work-order":  "/work-orders",
  "new-quote":       "/quotes",
  "new-invoice":     "/invoices",
  "schedule-service": "/service-schedule",
}

function QuickAddSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dispatch = useQuickAddDispatch()
  const router = useRouter()
  const pathname = usePathname()
  const { role, status } = useOrgPermissions()
  const { standardCreateEligibility, equipmentCreateEligibility } = useBillingAccess()
  const navPermissions = resolveMobileNavPermissions({ role, status })
  debugMobileNavResolution({ surface: "quick-add", role, status })

  function fire(action: QuickAddAction) {
    if (action === "new-equipment") {
      if (blockCreateIfNotEligible(equipmentCreateEligibility)) return
    } else {
      if (blockCreateIfNotEligible(standardCreateEligibility)) return
    }
    onClose()
    const target = ACTION_ROUTES[action]
    if (pathname === target) {
      // Already on the right page — use context broadcast
      setTimeout(() => dispatch(action), 80)
    } else {
      // Navigate to the target page with ?action= param so it opens the modal on mount
      router.push(`${target}?action=${action}`)
    }
  }

  const filteredItems = [
    { icon: UserPlus,      label: "Add Customer",    action: "new-customer", anyOf: ["canManageProspects", "canViewBilling"] },
    { icon: Wrench,        label: "Add Equipment",   action: "new-equipment", anyOf: ["canViewAllWorkOrders"] },
    { icon: CalendarPlus,  label: "Schedule Service", action: "schedule-service", anyOf: ["canManageDispatch"] },
    { icon: ClipboardPlus, label: "New Work Order",  action: "new-work-order", anyOf: ["canViewAllWorkOrders", "canManageDispatch"] },
    { icon: FilePlus,      label: "Create Quote",    action: "new-quote", anyOf: ["canEditQuotes"] },
    { icon: ReceiptText,   label: "Create Invoice",  action: "new-invoice", anyOf: ["canEditInvoices"] },
  ] satisfies { icon: React.ElementType; label: string; action: QuickAddAction; anyOf?: (keyof OrgPermissions)[] }[]
  const items = filteredItems.filter((item) => allowed(navPermissions, item.anyOf))

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="px-5 pt-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-foreground">Quick Add</p>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {items.map(({ icon: Icon, label, action }) => (
            <button
              key={label}
              onClick={() => fire(action)}
              className="flex flex-col items-center gap-2 p-3.5 rounded-xl border border-border bg-muted/30 active:scale-95 transition-transform"
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ background: `${ACCENT}22` }}
              >
                <Icon className="w-5 h-5" style={{ color: ACCENT }} />
              </div>
              <span className="text-[11px] font-medium text-foreground text-center leading-tight">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </BottomSheet>
  )
}

// ─── MoreSheet ────────────────────────────────────────────────────────────────

function MoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname()
  const { role, status } = useOrgPermissions()
  const navPermissions = resolveMobileNavPermissions({ role, status })
  debugMobileNavResolution({ surface: "more", role, status })

  const allItems: { icon: React.ElementType; label: string; href: string; anyOf?: (keyof OrgPermissions)[] }[] = [
    { icon: HardHat, label: "Today", href: "/technicians/today", anyOf: ["canUseTechnicianWorkspace"] },
    { icon: Wrench, label: "Equipment", href: "/equipment", anyOf: ["canViewAllWorkOrders", "canViewAssignedWorkOrdersOnly", "canEditWorkOrders"] },
    { icon: ClipboardList, label: "Work Orders", href: "/work-orders", anyOf: ["canViewAllWorkOrders", "canViewAssignedWorkOrdersOnly", "canEditWorkOrders"] },
    { icon: MaintenancePlansLucideIcon, label: "Maintenance", href: "/maintenance-plans", anyOf: ["canManageDispatch"] },
    { icon: FileText, label: "Quotes", href: "/quotes", anyOf: ["canViewQuotes", "canEditQuotes"] },
    { icon: Receipt, label: "Invoices", href: "/invoices", anyOf: ["canViewBilling", "canEditInvoices"] },
    { icon: ShoppingCart, label: "Purchase Orders", href: "/purchase-orders", anyOf: ["canViewBilling"] },
    { icon: BarChart3, label: "Reports", href: "/reports", anyOf: ["canViewOperationalReports", "canViewFinancialReports"] },
    { icon: Sparkles, label: "Insights", href: "/insights", anyOf: ["canViewInsights"] },
    { icon: Settings, label: "Settings", href: "/settings/workspace", anyOf: ["canManageSettings", "canManageWorkspaceSettings", "canManagePortalSettings"] },
  ]
  const filteredItems = allItems.filter((item) => allowed(navPermissions, item.anyOf))
  const items = filteredItems.length > 0
    ? filteredItems
    : [
        { icon: Users, label: "Customers", href: "/customers" },
        { icon: Wrench, label: "Equipment", href: "/equipment" },
        { icon: ClipboardList, label: "Work Orders", href: "/work-orders" },
        { icon: CalendarClock, label: "Service Schedule", href: "/service-schedule" },
        { icon: Settings, label: "Settings", href: "/settings/workspace" },
      ]

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="px-5 pt-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-foreground">More</p>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex flex-col divide-y divide-border">
          {items.map((item) => {
            const active = isActive(pathname, item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className="flex items-center gap-3 py-3.5 transition-colors"
                style={active ? { color: ACCENT } : undefined}
              >
                <item.icon
                  className="w-4 h-4 shrink-0"
                  style={{ color: active ? ACCENT : "var(--muted-foreground)" }}
                />
                <span className={cn("text-sm", active && "font-semibold")}>{item.label}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </BottomSheet>
  )
}

// ─── MobileBottomNav ──────────────────────────────────────────────────────────

export function MobileBottomNav() {
  const pathname = usePathname()
  const { role, status } = useOrgPermissions()
  const navPermissions = resolveMobileNavPermissions({ role, status })
  debugMobileNavResolution({
    surface: "bottom-nav",
    role,
    status,
    technicianWorkspace: navPermissions.canUseTechnicianWorkspace,
  })
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)

  const navItems: ({ icon: React.ElementType; label: string; href: string } | null)[] = [
    { icon: LayoutDashboard, label: "Home",      href: "/" },
    navPermissions.canUseTechnicianWorkspace
      ? { icon: HardHat, label: "Today", href: "/technicians/today" }
      : { icon: CalendarClock,   label: "Schedule",  href: "/service-schedule" },
    null, // center FAB
    navPermissions.canUseTechnicianWorkspace
      ? { icon: ClipboardList, label: "Jobs", href: "/work-orders" }
      : { icon: Users,           label: "Customers", href: "/customers" },
    { icon: MoreHorizontal,  label: "More",      href: "" },
  ]

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-[80] lg:hidden"
        aria-label="Mobile navigation"
      >
        <div
          className="bg-background/95 backdrop-blur-md border-t border-border shadow-[0_-2px_16px_rgba(0,0,0,0.08)] rounded-t-2xl"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          <div className="flex items-center justify-around px-2 pt-2">
            {navItems.map((item, i) => {
              if (item === null) {
                return (
                  <div key="fab" className="flex flex-col items-center" style={{ marginTop: "-18px" }}>
                    <button
                      onClick={() => setQuickAddOpen(true)}
                      className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform"
                      style={{ background: ACCENT }}
                      aria-label="Quick add"
                    >
                      <Plus className="w-7 h-7 text-white" strokeWidth={2.5} />
                    </button>
                    <span className="text-[10px] font-medium mt-1" style={{ color: ACCENT }}>Add</span>
                  </div>
                )
              }

              const { icon: Icon, label, href } = item

              if (href === "") {
                const active = moreOpen
                return (
                  <button
                    key="more"
                    onClick={() => setMoreOpen(true)}
                    className="flex flex-col items-center gap-1 px-3 py-1 min-w-[52px] active:opacity-70 transition-opacity"
                    aria-label="More"
                  >
                    <Icon className="w-5 h-5" style={{ color: active ? ACCENT : "var(--muted-foreground)" }} />
                    <span className="text-[10px] font-medium" style={{ color: active ? ACCENT : "var(--muted-foreground)" }}>More</span>
                  </button>
                )
              }

              const active = isActive(pathname, href)
              return (
                <Link
                  key={href}
                  href={href}
                  className="flex flex-col items-center gap-1 px-3 py-1 min-w-[52px] active:opacity-70 transition-opacity"
                  aria-label={label}
                >
                  <Icon className="w-5 h-5" style={{ color: active ? ACCENT : "var(--muted-foreground)" }} />
                  <span className="text-[10px] font-medium" style={{ color: active ? ACCENT : "var(--muted-foreground)" }}>{label}</span>
                </Link>
              )
            })}
          </div>
        </div>
      </nav>

      <QuickAddSheet open={quickAddOpen} onClose={() => setQuickAddOpen(false)} />
      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  )
}
