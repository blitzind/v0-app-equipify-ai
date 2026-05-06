"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import { AppTopbar } from "@/components/app-topbar"
import { MobileBottomNav } from "@/components/mobile-bottom-nav"
import { ScheduleServiceDrawer } from "@/components/schedule-service-drawer"
import { useQuickAdd } from "@/lib/quick-add-context"
import { useBillingAccess } from "@/lib/billing-access-context"
import { blockCreateIfNotEligible } from "@/lib/billing/guard-toast"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard, Users, Wrench, ClipboardList, CalendarClock,
  HardHat, BarChart3, Globe, Settings, FileText, Receipt, Plug, ShoppingCart,
  CalendarRange, Store, Package, Upload, Bell,
  Warehouse,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { MaintenancePlansBrandTile, MaintenancePlansLucideIcon } from "@/lib/navigation/module-icons"

// ─── Route meta ───────────────────────────────────────────────────────────────

interface RouteMeta {
  title: string
  subtitle: string
  icon: LucideIcon
  cta?: { label: string; href?: string }
}

const ROUTE_META: Record<string, RouteMeta> = {
  "/": {
    title: "Dashboard",
    subtitle: "Your real-time overview of equipment, work orders, and revenue.",
    icon: LayoutDashboard,
  },
  "/customers": {
    title: "Customers",
    subtitle: "Manage accounts, contracts, equipment, and service history.",
    icon: Users,
    cta: { label: "+ New Customer" },
  },
  "/equipment": {
    title: "Equipment",
    subtitle: "Track every asset — service status, warranty, and maintenance history.",
    icon: Wrench,
    cta: { label: "+ Add Equipment" },
  },
  "/work-orders": {
    title: "Work Orders",
    subtitle: "Create, assign, and monitor all active and historical work orders.",
    icon: ClipboardList,
    cta: { label: "+ New Work Order" },
  },
  "/dispatch": {
    title: "Dispatch Board",
    subtitle: "Weekly crew schedule—drag work orders to assign times and technicians.",
    icon: CalendarRange,
  },
  "/service-schedule": {
    title: "Service Schedule",
    subtitle: "Upcoming maintenance services grouped by month, with notification and work order previews.",
    icon: CalendarClock,
  },
  "/maintenance-plans": {
    title: "Maintenance Plans",
    subtitle: "Recurring service schedules with automated notifications and work order creation.",
    icon: MaintenancePlansLucideIcon,
    cta: { label: "+ New Plan" },
  },
  "/technicians": {
    title: "Technicians",
    subtitle: "Manage your workforce, assignments, certifications, and productivity.",
    icon: HardHat,
    cta: { label: "+ Add Technician" },
  },
  "/technicians/today": {
    title: "My jobs today",
    subtitle: "Field view — work orders assigned to you for today and open undated jobs.",
    icon: HardHat,
  },
  "/quotes": {
    title: "Quotes",
    subtitle: "Create, send, and track service quotes awaiting customer approval.",
    icon: FileText,
    cta: { label: "+ New Quote" },
  },
  "/invoices": {
    title: "Invoices",
    subtitle: "Manage all invoices, track outstanding balances, and record payments.",
    icon: Receipt,
    cta: { label: "+ New Invoice" },
  },
  "/purchase-orders": {
    title: "Purchase Orders",
    subtitle: "Track vendor orders for parts, materials, equipment, and supplies.",
    icon: ShoppingCart,
    cta: { label: "+ New PO" },
  },
  "/vendors": {
    title: "Vendors",
    subtitle: "Manage supplier contacts and addresses for purchase orders.",
    icon: Store,
  },
  "/catalog": {
    title: "Catalog",
    subtitle:
      "Manage reusable items imported from manufacturer price lists for quotes, invoices, work orders, and purchase orders.",
    icon: Package,
  },
  "/catalog/import": {
    title: "Import price list",
    subtitle: "Upload a manufacturer or vendor price list to extract catalog lines with AI review.",
    icon: Upload,
  },
  "/reports": {
    title: "Reports",
    subtitle: "Track revenue, service performance, asset activity, and technician productivity.",
    icon: BarChart3,
    cta: { label: "Export Report" },
  },
  "/portal": {
    title: "Customer Portal",
    subtitle: "Self-service access for customers to view equipment, requests, and invoices.",
    icon: Globe,
  },
  "/integrations": {
    title: "Integrations",
    subtitle: "Connect Equipify.ai with the tools you already use to automate workflows, sync data, and streamline operations.",
    icon: Plug,
    cta: { label: "Request Integration" },
  },
  "/communications": {
    title: "Communications",
    subtitle:
      "Track customer emails, reminders, delivery status, quote follow-ups, invoice notifications, and automated outreach activity.",
    icon: Bell,
  },
}

// Routes that render their own full-bleed hero — PageHero is suppressed.
const HERO_SUPPRESS = new Set(["/insights", "/ai-assistants", "/integrations"])

/** Per-area hero icon color (title card only); primary CTAs stay orange via `Button`. */
const FEATURE_ICON_HEX: Record<string, string> = {
  "/": "#6366F1",
  "/customers": "#2563EB",
  "/equipment": "#64748B",
  "/inventory": "#78716C",
  "/work-orders": "#22C55E",
  "/dispatch": "#0EA5E9",
  "/service-schedule": "#A855F7",
  "/maintenance-plans": "#F59E0B",
  "/technicians": "#4F46E5",
  "/technicians/today": "#4F46E5",
  "/quotes": "#06B6D4",
  "/invoices": "#06B6D4",
  "/purchase-orders": "#06B6D4",
  "/vendors": "#F59E0B",
  "/catalog": "#D97706",
  "/catalog/import": "#D97706",
  "/reports": "#6366F1",
  "/portal": "#2563EB",
  "/integrations": "#2563EB",
  "/communications": "#6366F1",
}

function getFeatureIconColor(pathname: string): string {
  if (FEATURE_ICON_HEX[pathname]) return FEATURE_ICON_HEX[pathname]!
  if (pathname.startsWith("/customers/")) return "#2563EB"
  if (pathname.startsWith("/technicians/today")) return "#4F46E5"
  if (pathname.startsWith("/work-orders/")) return "#22C55E"
  if (pathname.startsWith("/settings/")) return "#6366F1"
  return "#64748B"
}

const SETTINGS_AREA_HERO: RouteMeta = {
  title: "Workspace Settings",
  subtitle:
    "Manage your organization, branding, team, billing, integrations, and platform preferences.",
  icon: Settings,
}

function resolveMeta(pathname: string): RouteMeta | null {
  if (HERO_SUPPRESS.has(pathname)) return null
  if (pathname.startsWith("/settings/")) return SETTINGS_AREA_HERO
  if (ROUTE_META[pathname]) return ROUTE_META[pathname]
  if (pathname.startsWith("/customers/")) return { title: "Customer Detail", subtitle: "Full account overview — equipment, work orders, and service history.", icon: Users }
  if (
    pathname.startsWith("/technicians/") &&
    pathname !== "/technicians" &&
    !pathname.startsWith("/technicians/today")
  ) {
    return { title: "Technicians", subtitle: "Workforce, assignments, and certifications.", icon: HardHat }
  }
  if (pathname.startsWith("/work-orders/")) return { title: "Work Order Detail", subtitle: "Full details, activity timeline, and technician notes.", icon: ClipboardList }
  return null
}

// ─── PageHero ─────────────────────────────────────────────────────────────────

function PageHero({
  title,
  subtitle,
  icon: Icon,
  featureColor,
  pathname,
}: {
  title: string
  subtitle: string
  icon: LucideIcon
  featureColor: string
  pathname: string
}) {
  const maintenancePlansHero = pathname === "/maintenance-plans"
  const isSettingsArea = pathname.startsWith("/settings/")
  return (
    <div
      className={cn(
        "px-3 sm:px-6 shrink-0",
        isSettingsArea ? "pt-4 sm:pt-6 pb-2" : "pt-4 sm:pt-5 pb-1",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-3 sm:gap-4 bg-card border border-border rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] px-4 sm:px-6",
          isSettingsArea ? "py-4 sm:py-6" : "py-4 sm:py-5",
        )}
      >
        {maintenancePlansHero ? (
          <MaintenancePlansBrandTile size="md" />
        ) : (
        <div
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl border flex items-center justify-center shrink-0"
          style={{
            backgroundColor: `color-mix(in srgb, ${featureColor} 14%, var(--card))`,
            borderColor: `color-mix(in srgb, ${featureColor} 24%, var(--border))`,
          }}
        >
          <Icon className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" style={{ color: featureColor }} />
        </div>
        )}
        <div className="min-w-0 flex-1">
          <h1
            className={cn(
              "font-semibold text-foreground tracking-tight leading-tight text-balance",
              isSettingsArea ? "text-lg sm:text-xl" : "text-base sm:text-lg",
            )}
          >
            {title}
          </h1>
          <p
            className={cn(
              "text-muted-foreground mt-1 sm:mt-1.5 leading-relaxed",
              isSettingsArea
                ? "text-sm sm:text-[0.9375rem] max-w-3xl text-pretty"
                : "text-xs sm:text-sm line-clamp-1",
            )}
          >
            {subtitle}
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── PageShell ────────────────────────────────────────────────────────────────

export function PageShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const meta = resolveMeta(pathname)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const { standardCreateEligibility } = useBillingAccess()
  useQuickAdd("schedule-service", () => {
    if (blockCreateIfNotEligible(standardCreateEligibility)) return
    setScheduleOpen(true)
  })

  return (
    <>
      <AppTopbar />
      {meta && (
        <PageHero
          title={meta.title}
          subtitle={meta.subtitle}
          icon={meta.icon}
          featureColor={getFeatureIconColor(pathname)}
          pathname={pathname}
        />
      )}
      <main className="flex-1 overflow-y-auto">
        {/* pb-24 on mobile gives clearance above the fixed bottom nav (≈80px bar + safe area) */}
        <div className="max-w-[1440px] mx-auto p-3 sm:p-6 pb-24 lg:pb-6">
          {children}
        </div>
      </main>

      {/* Mobile-only bottom navigation — hidden at lg+ */}
      <MobileBottomNav />

      {/* Schedule Service drawer triggered from Quick Add */}
      <ScheduleServiceDrawer
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
      />
    </>
  )
}
