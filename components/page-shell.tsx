"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import { AppTopbar } from "@/components/app-topbar"
import { MobileBottomNav } from "@/components/mobile-bottom-nav"
import { ScheduleServiceDrawer } from "@/components/schedule-service-drawer"
import { useQuickAdd } from "@/lib/quick-add-context"
import { useBillingAccess } from "@/lib/billing-access-context"
import { blockCreateIfNotEligible } from "@/lib/billing/guard-toast"
import { PageHeroCard } from "@/components/page-hero-card"
import { PAGE_HERO_SHELL_OUTER } from "@/lib/page-hero-tokens"
import {
  LayoutDashboard, Users, Wrench, ClipboardList, CalendarClock,
  HardHat, BarChart3, Globe, Settings, FileText, Receipt, Plug, ShoppingCart,
  CalendarRange, Store, Package, Upload, Bell,
  Warehouse,
  Landmark,
} from "lucide-react"
import Image from "next/image"
import type { LucideIcon } from "lucide-react"
import {
  MaintenancePlansBrandTile,
  MaintenancePlansLucideIcon,
  MembershipsLucideIcon,
} from "@/lib/navigation/module-icons"

// ─── Route meta ───────────────────────────────────────────────────────────────

interface RouteMeta {
  title: string
  subtitle: string
  icon: LucideIcon
  cta?: { label: string; href?: string }
  /** Optional right-side mark in the title card (e.g. partner brand). */
  heroAccessory?: "blitzpay-wordmark"
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
    title: "Schedule",
    subtitle: "Upcoming maintenance services grouped by month, with notification and work order previews.",
    icon: CalendarClock,
  },
  "/maintenance-plans": {
    title: "Maintenance",
    subtitle: "Recurring service plans with automated notifications and work order creation.",
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
  "/inventory": {
    title: "Inventory",
    subtitle: "Track parts by location, transfers, work order consumption, and van stock.",
    icon: Warehouse,
  },
  "/catalog/import": {
    title: "Import price list",
    subtitle: "Upload a manufacturer or vendor price list to extract catalog lines with AI review.",
    icon: Upload,
  },
  "/reports": {
    title: "Operations",
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
  "/memberships": {
    title: "Memberships & recurring agreements",
    subtitle:
      "Track service memberships, preventive agreements, renewal pipeline, autopilot coverage, and native recurring billing health.",
    icon: MembershipsLucideIcon,
  },
  "/insights/financial-command-center": {
    title: "BlitzPay Financial Command Center",
    subtitle:
      "Monitor receivables, cash flow, treasury activity, collections, forecasts, and financial operations health across your business.",
    icon: Landmark,
    heroAccessory: "blitzpay-wordmark",
  },
}

// Routes that render their own full-bleed hero — PageHero is suppressed.
const HERO_SUPPRESS = new Set(["/insights", "/ai-assistants", "/ai-ops", "/integrations"])

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
  "/insights/financial-command-center": "#16a34a",
  "/memberships": "#059669",
}

function getFeatureIconColor(pathname: string): string {
  if (FEATURE_ICON_HEX[pathname]) return FEATURE_ICON_HEX[pathname]!
  if (pathname.startsWith("/insights/financial-command-center")) return "#16a34a"
  if (pathname.startsWith("/memberships")) return "#059669"
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
  if (pathname.startsWith("/insights/financial-command-center")) {
    return ROUTE_META["/insights/financial-command-center"] ?? null
  }
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
  heroAccessory,
}: {
  title: string
  subtitle: string
  icon: LucideIcon
  featureColor: string
  pathname: string
  heroAccessory?: RouteMeta["heroAccessory"]
}) {
  const maintenancePlansHero = pathname === "/maintenance-plans"
  return (
    <div className={PAGE_HERO_SHELL_OUTER}>
      <PageHeroCard
        title={title}
        subtitle={subtitle}
        trailing={
          heroAccessory === "blitzpay-wordmark" ? (
            <Image
              src="/blitzpay-wordmark-transparent.png"
              alt="BlitzPay"
              width={275}
              height={60}
              className="h-[35px] w-auto max-w-[min(92vw,180px)] sm:h-10 sm:max-w-[min(260px,48vw)] object-contain object-left sm:object-right opacity-95 bg-transparent"
              priority
            />
          ) : undefined
        }
        {...(maintenancePlansHero
          ? { leading: <MaintenancePlansBrandTile size="stat" /> }
          : { icon: Icon, featureColor })}
      />
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
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[200] focus:left-3 focus:top-3 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2.5 focus:text-sm focus:font-medium focus:text-primary-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
      >
        Skip to main content
      </a>
      <AppTopbar />
      {meta && (
        <PageHero
          title={meta.title}
          subtitle={meta.subtitle}
          icon={meta.icon}
          featureColor={getFeatureIconColor(pathname)}
          pathname={pathname}
          heroAccessory={meta.heroAccessory}
        />
      )}
      <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto outline-none scroll-mt-14 md:scroll-mt-16">
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
