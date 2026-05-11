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
  Landmark,
} from "lucide-react"
import Image from "next/image"
import type { LucideIcon } from "lucide-react"
import { MaintenancePlansBrandTile, MaintenancePlansLucideIcon } from "@/lib/navigation/module-icons"

// ─── Route meta ───────────────────────────────────────────────────────────────

interface RouteMeta {
  title: string
  subtitle: string
  icon: LucideIcon
  cta?: { label: string; href?: string }
  /** Optional right-side mark in the title card (e.g. partner brand). */
  heroAccessory?: "blitzpay-wordmark"
  /** When true, subtitle wraps like Settings hero instead of a single-line clamp. */
  heroSubtitleMultiline?: boolean
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
  "/insights/financial-command-center": {
    title: "BlitzPay Financial Command Center",
    subtitle:
      "Monitor receivables, cash flow, treasury activity, collections, forecasts, and financial operations health across your business.",
    icon: Landmark,
    heroAccessory: "blitzpay-wordmark",
    heroSubtitleMultiline: true,
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
  "/insights/financial-command-center": "#f59f1c",
}

function getFeatureIconColor(pathname: string): string {
  if (FEATURE_ICON_HEX[pathname]) return FEATURE_ICON_HEX[pathname]!
  if (pathname.startsWith("/insights/financial-command-center")) return "#f59f1c"
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
  heroAccessory,
  heroSubtitleMultiline,
}: {
  title: string
  subtitle: string
  icon: LucideIcon
  featureColor: string
  pathname: string
  heroAccessory?: RouteMeta["heroAccessory"]
  heroSubtitleMultiline?: boolean
}) {
  const maintenancePlansHero = pathname === "/maintenance-plans"
  const isSettingsArea = pathname.startsWith("/settings/")
  const multilineSubtitle = Boolean(isSettingsArea || heroSubtitleMultiline)
  return (
    <div
      className={cn(
        "px-3 sm:px-6 shrink-0",
        isSettingsArea ? "pt-4 sm:pt-6 pb-2" : "pt-4 sm:pt-5 pb-1",
      )}
    >
      <div
        className={cn(
          "flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4 bg-card border border-border rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] px-4 sm:px-6",
          isSettingsArea ? "py-4 sm:py-6" : "py-4 sm:py-5",
        )}
      >
        <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center sm:gap-4">
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
                multilineSubtitle
                  ? "text-sm sm:text-[0.9375rem] max-w-3xl text-pretty"
                  : "text-xs sm:text-sm line-clamp-1",
              )}
            >
              {subtitle}
            </p>
          </div>
        </div>
        {heroAccessory === "blitzpay-wordmark" ? (
          <div className="flex shrink-0 items-center justify-start sm:justify-end pl-12 sm:pl-0">
            <Image
              src="/blitzpay-wordmark.png"
              alt="BlitzPay"
              width={220}
              height={48}
              className="h-7 w-auto max-w-[min(200px,42vw)] sm:h-8 sm:max-w-[220px] object-contain object-left sm:object-right opacity-95"
              priority
            />
          </div>
        ) : null}
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
          heroSubtitleMultiline={meta.heroSubtitleMultiline}
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
