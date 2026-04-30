"use client"

import { usePathname } from "next/navigation"
import { AppTopbar } from "@/components/app-topbar"

// ─── Route meta ──────────────────────────────────────────────────────────────
// Each entry defines the hero title and subtitle for a route.
// Routes listed in HERO_SUPPRESS will NOT render a PageHero (they manage their own).

interface RouteMeta {
  title: string
  subtitle: string
}

const ROUTE_META: Record<string, RouteMeta> = {
  "/": {
    title: "Dashboard",
    subtitle: "Your real-time overview of equipment, work orders, and revenue.",
  },
  "/customers": {
    title: "Customers",
    subtitle: "Manage accounts, contracts, equipment, and service history.",
  },
  "/equipment": {
    title: "Equipment",
    subtitle: "Track every asset — service status, warranty, and maintenance history.",
  },
  "/work-orders": {
    title: "Work Orders",
    subtitle: "Create, assign, and monitor all active and historical work orders.",
  },
  "/service-schedule": {
    title: "Service Schedule",
    subtitle: "View and manage upcoming preventive maintenance and field visits.",
  },
  "/maintenance-plans": {
    title: "Maintenance Plans",
    subtitle: "Recurring service schedules with automated notifications and work order creation.",
  },
  "/technicians": {
    title: "Technicians",
    subtitle: "Manage your workforce, assignments, certifications, and productivity.",
  },
  "/reports": {
    title: "Reports",
    subtitle: "Track revenue, service performance, asset activity, and technician productivity.",
  },
  "/portal": {
    title: "Customer Portal",
    subtitle: "Self-service access for customers to view equipment, requests, and invoices.",
  },
  "/billing": {
    title: "Billing",
    subtitle: "Manage invoices, quotes, and payment history.",
  },
  "/settings/workspace": {
    title: "Workspace Settings",
    subtitle: "Configure your company profile, branding, and regional preferences.",
  },
  "/settings/team": {
    title: "Team Members",
    subtitle: "Invite users, assign roles, and manage seat allocations.",
  },
  "/settings/billing": {
    title: "Billing & Subscription",
    subtitle: "Manage your plan, payment methods, and invoice history.",
  },
  "/settings/permissions": {
    title: "Permissions",
    subtitle: "Role-based access control across all modules.",
  },
}

// Routes that render their own full-bleed hero — PageHero is suppressed.
const HERO_SUPPRESS = new Set(["/insights"])

function resolveMeta(pathname: string): RouteMeta | null {
  if (HERO_SUPPRESS.has(pathname)) return null
  if (ROUTE_META[pathname]) return ROUTE_META[pathname]
  if (pathname.startsWith("/customers/")) return { title: "Customer Detail", subtitle: "Full account overview — equipment, work orders, and service history." }
  if (pathname.startsWith("/work-orders/")) return { title: "Work Order Detail", subtitle: "Full details, activity timeline, and technician notes." }
  if (pathname.startsWith("/settings/")) return ROUTE_META["/settings/workspace"] ?? null
  return null
}

// ─── PageHero ─────────────────────────────────────────────────────────────────

function PageHero({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="px-6 pt-6 pb-4 border-b border-border bg-card shrink-0">
      <h1 className="text-xl font-bold text-foreground tracking-tight leading-tight text-balance">
        {title}
      </h1>
      <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
        {subtitle}
      </p>
    </div>
  )
}

// ─── PageShell ────────────────────────────────────────────────────────────────

export function PageShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const meta = resolveMeta(pathname)

  return (
    <>
      <AppTopbar />
      {meta && <PageHero title={meta.title} subtitle={meta.subtitle} />}
      <main className="flex-1 overflow-y-auto p-6">
        {children}
      </main>
    </>
  )
}
