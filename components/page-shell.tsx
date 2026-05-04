"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import { AppTopbar } from "@/components/app-topbar"
import { MobileBottomNav } from "@/components/mobile-bottom-nav"
import { ScheduleServiceDrawer } from "@/components/schedule-service-drawer"
import { useQuickAdd } from "@/lib/quick-add-context"
import {
  LayoutDashboard, Users, Wrench, ClipboardList, CalendarClock,
  HardHat, BarChart3, Globe, Settings, Building2,
  CreditCard, Shield, Sparkles, FileText, Receipt, Plug, ShoppingCart,
  CalendarRange,
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
  "/settings/workspace": {
    title: "Workspace Settings",
    subtitle: "Configure your company profile, branding, and regional preferences.",
    icon: Building2,
  },
  "/settings/team": {
    title: "Team Members",
    subtitle: "Invite users, assign roles, and manage seat allocations.",
    icon: Users,
  },
  "/settings/billing": {
    title: "Billing & Subscription",
    subtitle: "Manage your plan, payment methods, and invoice history.",
    icon: CreditCard,
  },
  "/settings/permissions": {
    title: "Permissions",
    subtitle: "Role-based access control across all modules.",
    icon: Shield,
  },
  "/settings/equipment-types": {
    title: "Equipment Types",
    subtitle: "Manage the categories used to classify equipment across your workspace.",
    icon: Wrench,
  },
  "/integrations": {
    title: "Integrations",
    subtitle: "Connect Equipify.ai with the tools you already use to automate workflows, sync data, and streamline operations.",
    icon: Plug,
    cta: { label: "Request Integration" },
  },
}

// Routes that render their own full-bleed hero — PageHero is suppressed.
const HERO_SUPPRESS = new Set(["/insights", "/integrations"])

/** Per-area hero icon color (title card only); primary CTAs stay orange via `Button`. */
const FEATURE_ICON_HEX: Record<string, string> = {
  "/": "#6366F1",
  "/customers": "#2563EB",
  "/equipment": "#64748B",
  "/work-orders": "#22C55E",
  "/dispatch": "#0EA5E9",
  "/service-schedule": "#A855F7",
  "/maintenance-plans": "#F59E0B",
  "/technicians": "#4F46E5",
  "/quotes": "#06B6D4",
  "/invoices": "#06B6D4",
  "/purchase-orders": "#06B6D4",
  "/reports": "#6366F1",
  "/portal": "#2563EB",
  "/settings/workspace": "#64748B",
  "/settings/team": "#64748B",
  "/settings/billing": "#06B6D4",
  "/settings/permissions": "#64748B",
  "/settings/equipment-types": "#64748B",
  "/integrations": "#2563EB",
}

function getFeatureIconColor(pathname: string): string {
  if (FEATURE_ICON_HEX[pathname]) return FEATURE_ICON_HEX[pathname]!
  if (pathname.startsWith("/customers/")) return "#2563EB"
  if (pathname.startsWith("/work-orders/")) return "#22C55E"
  if (pathname.startsWith("/settings/")) return FEATURE_ICON_HEX[pathname] ?? "#64748B"
  return "#64748B"
}

function resolveMeta(pathname: string): RouteMeta | null {
  if (HERO_SUPPRESS.has(pathname)) return null
  if (ROUTE_META[pathname]) return ROUTE_META[pathname]
  if (pathname.startsWith("/customers/")) return { title: "Customer Detail", subtitle: "Full account overview — equipment, work orders, and service history.", icon: Users }
  if (pathname.startsWith("/work-orders/")) return { title: "Work Order Detail", subtitle: "Full details, activity timeline, and technician notes.", icon: ClipboardList }
  if (pathname.startsWith("/settings/")) return ROUTE_META["/settings/workspace"] ?? null
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
  return (
    <div className="px-3 sm:px-6 pt-4 sm:pt-5 pb-1 shrink-0">
      <div className="flex items-center gap-3 sm:gap-4 bg-card border border-border rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] px-4 sm:px-6 py-4 sm:py-5">
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
        <div className="min-w-0">
          <h1 className="text-base sm:text-lg font-semibold text-foreground tracking-tight leading-tight text-balance">
            {title}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 leading-relaxed line-clamp-1">
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
  useQuickAdd("schedule-service", () => setScheduleOpen(true))

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
